# Domain Break — दोस्त के साथ Online कैसे खेलें

दोस्त कहीं भी हो, किसी भी शहर में, अपने WiFi या मोबाइल डेटा पर — बस एक **link** खोलना है।
Game आपके (Host) PC पर चलता है, दोस्त को वो live दिखता है और वो **Player 2** बनकर अपने keyboard से खेलता है।

---

## 👦 दोस्त के लिए (Player 2) — बस 3 काम

1. जो **link** आपको मिला है (`https://….trycloudflare.com/?join=1`), उसे **PC / laptop** पर
   **Google Chrome** या **Microsoft Edge** में खोलें। (Mobile पर नहीं — keyboard चाहिए।)
2. **JOIN** दबाएँ। थोड़ी देर में आपके दोस्त का game दिखने लगेगा।
3. **पहले आप अपना character चुनें:** `A` / `D` से बदलें, `J` या `Enter` से confirm करें।
   फिर आपका दोस्त अपना character चुनेगा, और fight शुरू हो जाएगी।

### Controls (आपके keys)

| काम | Key |
|---|---|
| चलना | `A` / `D` |
| Jump | `W` |
| Block (दबाकर रखें) | `S` |
| Light attack (combo) | `J` `J` `J` |
| Heavy attack | `K` |
| Special 1 · 2 · 3 | `L` · `U` · `O` (O = super, energy चाहिए) |
| Domain Expansion (gauge भरने पर) | `I` |
| Dash | `Shift` |

Gamepad भी चलता है (X light, Y heavy, B / RB / RT specials, LT domain, LB dash)।
आवाज़ न आए तो page पर एक बार click कर दें।

---

## 🧑 Host के लिए (आप — Player 1)

1. Game folder में **`HOST-ONLINE.bat`** पर double-click करें (start.bat नहीं)।
   - एक काली window खुलेगी — **इसे खेलते समय बंद न करें।**
   - पहली बार ये ~55 MB का `cloudflared` download करेगा (एक ही बार)।
   - Game browser में अपने-आप खुल जाएगा (Chrome या Edge)।
2. Title screen पर **PLAY ONLINE WITH A FRIEND** → **HOST** दबाएँ।
3. Browser पूछेगा क्या share करना है → **यही tab (Domain Break)** चुनें और **“Also share tab audio”** on करें → **Share**।
4. **COPY INVITE LINK** दबाएँ और link दोस्त को WhatsApp पर भेज दें।
5. दोस्त के JOIN करते ही character select खुल जाएगा: **पहले दोस्त चुनेगा, फिर आप** (`A`/`D` + `Enter`)।
6. खेलते समय game वाला tab **सामने** रखें (minimize न करें)।

---

## ❓ कुछ गड़बड़ हो तो

| दिक्कत | क्या करें |
|---|---|
| HOST दबाने पर “start the game with HOST-ONLINE.bat” | आपने start.bat से खोला है। सब बंद करके **HOST-ONLINE.bat** से खोलें। |
| “Creating your invite link…” पर रुका है | Internet चेक करें। काली window बंद करके HOST-ONLINE.bat फिर से चलाएँ। |
| दोस्त को link नहीं खुल रहा | Host की काली window खुली है? Link पूरा copy हुआ? हर बार HOST-ONLINE.bat चलाने पर **नया link** बनता है — पुराना link काम नहीं करेगा। |
| दोस्त को “waiting for your friend to press HOST” | Host: game में **PLAY ONLINE → HOST** दबाकर tab share करें। |
| दोस्त को काली screen / video नहीं | Host: share करते समय **यही tab** चुना था? “Screen share stopped” दिखे तो **LEAVE** दबाकर फिर **HOST** करें। |
| दोस्त को थोड़ा delay लगता है | ये internet की दूरी है (नीचे ping दिखता है)। दोनों अच्छा network इस्तेमाल करें; host का upload अच्छा हो। |
| “Someone else is already playing” | एक समय में एक ही दोस्त join कर सकता है। |

---

**English (short):** Host runs `HOST-ONLINE.bat` → PLAY ONLINE → HOST → share this tab (with audio) → COPY INVITE LINK.
Friend opens the link in Chrome/Edge on a PC → JOIN → picks their fighter first (A/D + J), then the host picks.
Friend's keys: A/D move · W jump · S block · J light · K heavy · L/U/O specials · I domain · Shift dash.
