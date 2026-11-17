"""Domain Break - online host server (started by HOST-ONLINE.bat).

* Serves the game on http://localhost:8765
* Relays the online match over WebSockets (/ws): the host's video + sound go to the friend,
  the friend's key presses come back to the host.
* Opens a free Cloudflare "quick tunnel" (no account needed) so the friend can reach this PC from
  anywhere - any city, any network, mobile data - through one https link (the invite link).
  cloudflared.exe is downloaded into tools/ the first time (about 60 MB).
Only Python's standard library is used.
"""
import base64, hashlib, http.server, json, os, queue, re, socket, struct, subprocess, sys, threading, time, urllib.request

PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(ROOT, 'tools')
CLOUDFLARED = os.path.join(TOOLS, 'cloudflared.exe' if os.name == 'nt' else 'cloudflared')
CF_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/' + (
    'cloudflared-windows-amd64.exe' if os.name == 'nt' else 'cloudflared-linux-amd64')
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

state = {'url': None, 'tunnel_error': None, 'host': None, 'guest': None}
lock = threading.Lock()


# ------------------------------------------------------------------ websocket connection
class WS:
    """One WebSocket client. Sending happens on its own thread through a queue, so a slow friend never
    blocks the host; when the queue backs up, video frames are dropped until the next key frame."""

    def __init__(self, handler, role):
        self.sock = handler.connection
        self.rfile = handler.rfile
        self.role = role
        self.q = queue.PriorityQueue()   # text (keys, pings) jumps ahead of video
        self.seq = 0
        self.alive = True
        self.skipping = False
        threading.Thread(target=self._writer, daemon=True).start()

    def _writer(self):
        while self.alive:
            _, _, item = self.q.get()
            if item is None:
                break
            op, data = item
            try:
                n = len(data)
                head = bytes([0x80 | op])
                if n < 126:
                    head += bytes([n])
                elif n < 65536:
                    head += bytes([126]) + struct.pack('>H', n)
                else:
                    head += bytes([127]) + struct.pack('>Q', n)
                self.sock.sendall(head + data)
            except OSError:
                self.alive = False
                break

    def send(self, data, op=None):
        if not self.alive:
            return
        if op is None:
            op = 0x1 if isinstance(data, str) else 0x2
        if isinstance(data, str):
            data = data.encode('utf8')
        # binary media packet: [type 1=video 2=audio][flags 1=key]...
        if op == 0x2 and len(data) > 1 and data[0] == 1:
            key = data[1] & 1
            if self.q.qsize() > 24:
                self.skipping = True
            if self.skipping:
                if not key:
                    return False          # dropped: ask the host for a fresh key frame
                self.skipping = False
        self.seq += 1
        self.q.put((0 if op != 0x2 else 1, self.seq, (op, data)))
        return True

    def send_json(self, obj):
        self.send(json.dumps(obj))

    def _exact(self, n):
        buf = b''
        while len(buf) < n:
            chunk = self.rfile.read(n - len(buf))
            if not chunk:
                raise ConnectionError
            buf += chunk
        return buf

    def recv(self):
        """returns (opcode, payload) of one whole message"""
        parts, first_op = [], None
        while True:
            b1, b2 = self._exact(2)
            fin, op = b1 & 0x80, b1 & 0x0F
            n = b2 & 0x7F
            if n == 126:
                n = struct.unpack('>H', self._exact(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._exact(8))[0]
            mask = self._exact(4) if b2 & 0x80 else None
            data = self._exact(n)
            if mask:
                data = bytes(b ^ mask[i & 3] for i, b in enumerate(data)) if n < 2048 else _unmask(data, mask)
            if op == 0x8:
                raise ConnectionError
            if op == 0x9:
                self.send(data, 0xA)
                continue
            if op == 0xA:
                continue
            if op != 0:
                first_op = op
            parts.append(data)
            if fin:
                return first_op, b''.join(parts)

    def close(self):
        self.alive = False
        self.seq += 1
        self.q.put((-1, self.seq, None))
        try:
            self.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass


def _unmask(data, mask):
    # fast XOR for big frames (one big-integer XOR instead of a Python loop)
    n = len(data)
    m = int.from_bytes((mask * (n // 4 + 1))[:n], 'big')
    return (int.from_bytes(data, 'big') ^ m).to_bytes(n, 'big')


# ------------------------------------------------------------------ http + ws handler
class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        if not self.path.startswith('/ws'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        if self.path.startswith('/online-info'):
            body = json.dumps({'url': state['url'], 'error': state['tunnel_error'], 'guest': state['guest'] is not None}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith('/ws') and self.headers.get('Upgrade', '').lower() == 'websocket':
            return self.websocket()
        if self.path.startswith('/tools'):
            self.send_error(404)
            return
        return super().do_GET()

    def do_POST(self):
        # only for the automated self-test (DB_TEST_OUT=folder): saves screenshots / logs
        out = os.environ.get('DB_TEST_OUT')
        n = int(self.headers.get('Content-Length') or 0)
        data = self.rfile.read(n)
        if not out or not self.path.startswith('/save'):
            self.send_error(404)
            return
        name = re.sub(r'[^a-zA-Z0-9_.-]', '', self.path.split('name=')[-1])
        if data.startswith(b'data:image'):
            open(os.path.join(out, name + '.png'), 'wb').write(base64.b64decode(data.split(b',', 1)[1]))
        else:
            open(os.path.join(out, name + '.json'), 'wb').write(data)
        self.send_response(200)
        self.send_header('Content-Length', '2')
        self.end_headers()
        self.wfile.write(b'ok')

    def websocket(self):
        role = 'host' if 'role=host' in self.path else 'guest'
        key = self.headers.get('Sec-WebSocket-Key', '')
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        self.send_response(101, 'Switching Protocols')
        self.send_header('Upgrade', 'websocket')
        self.send_header('Connection', 'Upgrade')
        self.send_header('Sec-WebSocket-Accept', accept)
        self.end_headers()
        self.wfile.flush()
        ws = WS(self, role)
        with lock:
            if role == 'guest':
                if state['guest'] is not None:
                    ws.send_json({'t': 'busy'})
                    time.sleep(0.3)
                    ws.close()
                    return
                state['guest'] = ws
                other = state['host']
            else:
                if state['host'] is not None:
                    state['host'].close()
                state['host'] = ws
                other = state['guest']
        if role == 'guest':
            print('  >> Your friend joined!' if other else '  >> Your friend opened the link (you are not hosting yet).')
            ws.send_json({'t': 'hello', 'host': other is not None})
            if other:
                other.send_json({'t': 'guest-joined'})
        else:
            ws.send_json({'t': 'hello', 'guest': other is not None})
            if other:
                other.send_json({'t': 'host-ready'})
        try:
            while ws.alive:
                op, data = ws.recv()
                if op == 0x1 and data.startswith(b'{"t":"ping"'):   # network round trip, answered right here
                    ws.send(data.replace(b'"ping"', b'"pong"', 1), 0x1)
                    continue
                with lock:
                    peer = state['guest'] if role == 'host' else state['host']
                if peer is None:
                    continue
                ok = peer.send(data, op)
                if ok is False and role == 'host':
                    ws.send_json({'t': 'needkey'})
        except (ConnectionError, OSError, ValueError):
            pass
        finally:
            ws.close()
            with lock:
                if state[role] is ws:
                    state[role] = None
                peer = state['guest'] if role == 'host' else state['host']
            if peer:
                peer.send_json({'t': 'guest-left' if role == 'guest' else 'host-left'})
            if role == 'guest':
                print('  >> Your friend left.')
        self.close_connection = True


# ------------------------------------------------------------------ cloudflare quick tunnel
def download_cloudflared():
    if os.path.exists(CLOUDFLARED):
        return True
    os.makedirs(TOOLS, exist_ok=True)
    print('Downloading cloudflared (free Cloudflare tunnel, ~60 MB, only the first time)...')
    tmp = CLOUDFLARED + '.part'
    try:
        with urllib.request.urlopen(CF_URL, timeout=60) as r, open(tmp, 'wb') as f:
            total = int(r.headers.get('Content-Length') or 0)
            got = 0
            while True:
                b = r.read(1 << 16)
                if not b:
                    break
                f.write(b)
                got += len(b)
                if total:
                    sys.stdout.write(f'\r  {got * 100 // total}%  ')
                    sys.stdout.flush()
        os.replace(tmp, CLOUDFLARED)
        print('\r  done.      ')
        return True
    except Exception as e:
        state['tunnel_error'] = f'Could not download cloudflared: {e}'
        print('  ' + state['tunnel_error'])
        return False


def run_tunnel():
    if not download_cloudflared():
        return
    while True:
        print('Opening the online tunnel...')
        try:
            p = subprocess.Popen([CLOUDFLARED, 'tunnel', '--url', f'http://localhost:{PORT}', '--no-autoupdate'],
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf8', errors='replace',
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except OSError as e:
            state['tunnel_error'] = f'Could not start cloudflared: {e}'
            print('  ' + state['tunnel_error'])
            return
        for line in p.stdout:
            m = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', line)
            if m and not state['url']:
                state['url'] = m.group(0)
                state['tunnel_error'] = None
                print('\n' + '=' * 64)
                print('  ONLINE READY.  Invite link for your friend:')
                print('  ' + state['url'] + '/?join=1')
                print('  (also shown in the game: PLAY ONLINE -> HOST -> COPY INVITE LINK)')
                print('=' * 64 + '\n')
        p.wait()
        state['url'] = None
        state['tunnel_error'] = 'The online tunnel stopped - reconnecting...'
        print('  Tunnel stopped, restarting in 3 s...')
        time.sleep(3)


def main():
    srv = http.server.ThreadingHTTPServer(('', PORT), Handler)
    srv.daemon_threads = True
    print(f'Domain Break is running at http://localhost:{PORT}  (keep this window open while you play)')
    if '--no-tunnel' not in sys.argv:
        threading.Thread(target=run_tunnel, daemon=True).start()
    if '--no-browser' not in sys.argv:
        threading.Timer(1.0, lambda: os.startfile(f'http://localhost:{PORT}/index.html') if os.name == 'nt' else None).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
