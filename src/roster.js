// ============================================================================
//  CHARACTER ROSTER — add new fighters here.
//  file:    path to a .glb (any humanoid; static or skinned, A-pose or T-pose)
//  kit:     moveset/VFX family: 'void' | 'shrine' | 'heavenly'
//  include/exclude: mesh node names to keep / drop (props, outline shells…)
//  crop:    { meshName: {min:[x,y,z], max:[x,y,z]} } keep only triangles inside
//           (units = fraction of character height, feet at y=0, facing +Z)
//  rig:     optional joint overrides (fractions of height), e.g. {hipY:0.5}
//  rotY:    degrees to rotate the model so it faces +Z
//  domainForm: optional second model { file, skeleton } the fighter turns into during its Domain Expansion
//  lines:   voice lines { intro, win, domain, purple } -> { jp, en }. Drop voices/<id>_<key>.mp3 to use real
//           recordings; otherwise the browser's text-to-speech reads them (voice: pitch/rate).
// ============================================================================
export const ROSTER = [
  {
    // Properly rigged model (real skeleton + skin weights) with real animation clips.
    // Moves without a clip use the procedural pose library retargeted onto this skeleton.
    id: 'gojo_street', name: 'GOJO', title: 'Street Form', file: 'models/gojo/model-animated (4).glb', kit: 'void',
    color: '#8a7dff', accent: '#4fd6ff', aura: '#a99bff',
    voice: { pitch: 1.05, rate: 1.0 },
    lines: {
      intro: { jp: '天上天下、唯我独尊', en: 'Throughout heaven and earth, I alone am the honored one.' },
      win: { jp: '心配すんな。僕、最強だから', en: "Relax. I'm the strongest." },
      domain: { jp: '領域展開…無限虚空', en: 'Domain Expansion… Boundless Void.' },
      purple: { jp: '順転「蒼」、反転「赫」…虚式「茈」', en: 'Blue… Red… Hollow technique: Purple.' },
    },
    // Domain Expansion: he pulls the blindfold off and becomes this unmasked model (real mixamo rig with
    // fingers, so the crossed-finger sign shows); back to the blindfold when the domain ends
    domainForm: {
      file: 'models/gojo_domain/model-rigged.glb',
      skeleton: { rig: 'mixamo', base: 'models/gojo_domain/model-rigged.glb', hide: ['Object_78'], noOutline: ['Object_81'], faces: ['Object_75', 'Object_81'],  // grey duplicate head mesh; thin double-sided hair cards (outline shell shows through as black blotches)
        clips: { walkF: { file: 'models/gojo_domain/model-rigged.glb', clip: 'walk_relaxed', speed: 1.5, loop: true } } },
    },
    skeleton: {
      base: 'models/gojo/model-animated (4).glb',
      // game animation name -> { file, clip, speed, loop }
      clips: {
        walkF: { file: 'models/gojo/model-rigged.glb', clip: 'walk_relaxed', speed: 1.5, loop: true },
        walkB: { file: 'models/gojo/model-rigged.glb', clip: 'walk_relaxed', speed: -1.3, loop: true },
        dash: { file: 'models/gojo/model-animated (2).glb', clip: 'sprint_exit_quaternius', speed: 1.4 },
        // → + K : running double jump-kick (rootMotion = how much of the clip's forward travel to keep)
        // NOTE: models/gojo/model-animated.glb (kick_jump) is currently missing -> this move is skipped until it's back
        jumpKick: { file: 'models/gojo/model-animated.glb', clip: 'kick_jump', speed: 1.6, rootMotion: 0.75 },
        // ← + K : somersault flip-kick, and ← + Dash : backflip evade (same clip)
        flipKick: { file: 'models/gojo/model-animated (1).glb', clip: 'backflip_quaternius', speed: 1.5 },
        backflip: { file: 'models/gojo/model-animated (1).glb', clip: 'backflip_quaternius', speed: 1.7 },
        // K : uppercut launcher
        heavy: { file: 'models/gojo/COMBO.glb', clip: 'melee_uppercut_quaternius', speed: 1.25, rootMotion: 0.55 },
        // J J J J : the melee_combo clip split into 3 hits, finished by the spinning kick
        comboJab: { file: 'models/gojo/COMBO.glb', clip: 'melee_combo_quaternius', from: 0, speed: 1.2, rootMotion: 0.5 },
        comboKick: { file: 'models/gojo/COMBO.glb', clip: 'melee_combo_quaternius', from: 0.18, speed: 1.1, rootMotion: 0.5 },
        comboLunge: { file: 'models/gojo/COMBO.glb', clip: 'melee_combo_quaternius', from: 0.88, speed: 1.2, rootMotion: 0.5 },
        spinKick: { file: 'models/gojo/COMBO.glb', clip: 'kick_spinning', from: 0.25, speed: 1.5, rootMotion: 0.5 },
        // → + K : overhead chop (used when the jump-kick file is not present)
        chop: { file: 'models/gojo/model-animated (4).glb', clip: 'karate_chop_overhead', speed: 2.4 },
        victory: { file: 'models/gojo/model-animated (3).glb', clip: 'celebrate_arms_wide', speed: 1 },
        open: { file: 'models/gojo/model-animated (3).glb', clip: 'celebrate_arms_wide', speed: 0.8 },
      },
    },
  },
  {
    id: 'sukuna', name: 'SUKUNA', title: 'Crimson Altar', file: 'models/sukuna/model-animated.glb', kit: 'shrine',
    color: '#ff3048', accent: '#ff9a3c', aura: '#ff2a3a',
    // Mixamo-rigged model with all clips in one file (models/sukuna/model-animated.glb)
    skeleton: {
      rig: 'mixamo',
      base: 'models/sukuna/model-animated.glb',
      clips: {
        walkF: { file: 'models/sukuna/model-animated.glb', clip: 'walk_relaxed', speed: 1.5, loop: true },
        walkB: { file: 'models/sukuna/model-animated.glb', clip: 'walk_relaxed', speed: -1.3, loop: true },
        dash: { file: 'models/sukuna/model-animated.glb', clip: 'sprint_loop_quaternius', speed: 1.3, loop: true },
        getup: { file: 'models/sukuna/model-animated.glb', clip: 'kipup_quaternius', speed: 2.6 },
        // J J J J : hook -> kick -> lunge -> roundhouse
        comboJab: { file: 'models/sukuna/model-animated.glb', clip: 'punch_hook_left', from: 0.38, speed: 2.2 },
        comboKick: { file: 'models/sukuna/model-animated.glb', clip: 'melee_combo_quaternius', from: 0.18, speed: 1.1, rootMotion: 0.5 },
        comboLunge: { file: 'models/sukuna/model-animated.glb', clip: 'melee_combo_quaternius', from: 0.88, speed: 1.2, rootMotion: 0.5 },
        spinKick: { file: 'models/sukuna/model-animated.glb', clip: 'aerial_roundhouse', from: 0.45, speed: 1.4 },
        // K : heavy cross   → + K : overhead chop   ← + K : spinning slash (anti-air)
        crossHeavy: { file: 'models/sukuna/model-animated.glb', clip: 'punch_cross', from: 0.15, speed: 1.6 },
        chop: { file: 'models/sukuna/model-animated.glb', clip: 'karate_chop_overhead', speed: 2.4 },
        spinSlash: { file: 'models/sukuna/model-animated.glb', clip: 'aerial_spin_slash', speed: 1.3 },
        // sits on a throne for the win pose and inside his domain
        victory: { file: 'models/sukuna/model-animated.glb', clip: 'idle_sit_relaxed', speed: 1, prop: 'throne' },
        open: { file: 'models/sukuna/model-animated.glb', clip: 'idle_sit_relaxed', speed: 1, prop: 'throne' },
      },
    },
    voice: { pitch: 0.55, rate: 0.88 },
    lines: {
      intro: { jp: '身の程を知れ、小僧', en: 'Know your place, fool.' },
      win: { jp: '誇れ。お前は強い', en: 'Stand proud. You were strong.' },
      domain: { jp: '領域展開…紅蓮祭壇', en: 'Domain Expansion… Crimson Altar.' },
    },
  },
  {
    id: 'toji', name: 'TOJI', title: 'Heavenly Breaker', file: 'models/toji/model-animated.glb', kit: 'heavenly',
    color: '#c8ff3c', accent: '#f4f4f4', aura: '#d6ff6a',
    // the fastest fighter: walk/dash ×1.45, every attack ×1.2, white motion lines while moving (no afterimages)
    speed: 1.45, atkSpeed: 1.2, afterimage: true, motionLines: true,
    // Mixamo-rigged model, all clips in one file. The two blades inside the model (shrunk at the ankle)
    // are cut out and put in his hand; the pistol is a built-in prop.
    skeleton: {
      rig: 'mixamo',
      base: 'models/toji/model-animated.glb',
      faces: ['Object_11'],   // face mesh: soft shading (no moustache-looking shadow under the nose)
      weapons: {
        blade: { mesh: 'wuqi2', hand: 'R', scale: 6, grip: 0.1 },   // curved glaive
        knife: { mesh: 'wuqi1', hand: 'R', scale: 7, grip: 0.22 },  // forked dagger (Inverted Spear)
        gun: { prop: 'pistol', hand: 'R', scale: 1 },
      },
      clips: {
        walkF: { file: 'models/toji/model-animated.glb', clip: 'walk_relaxed', speed: 1.5, loop: true },
        walkB: { file: 'models/toji/model-animated.glb', clip: 'walk_relaxed', speed: -1.3, loop: true },
        dash: { file: 'models/toji/model-animated.glb', clip: 'sprint_loop_quaternius', speed: 1.5, loop: true },
        backflip: { file: 'models/toji/model-animated.glb', clip: 'backflip_quaternius', speed: 1.7 },
        getup: { file: 'models/toji/model-animated.glb', clip: 'kipup_quaternius', speed: 2.6 },
        // J J J J : jab -> side kick -> hook -> spinning kick
        comboJab: { file: 'models/toji/model-animated.glb', clip: 'combo_jab_cross_hook', from: 0.33, speed: 2.0 },
        comboKick: { file: 'models/toji/model-animated.glb', clip: 'kick_side', from: 0.45, speed: 1.8 },
        comboLunge: { file: 'models/toji/model-animated.glb', clip: 'punch_hook_left', from: 0.4, speed: 1.6 },
        spinKick: { file: 'models/toji/model-animated.glb', clip: 'kick_spinning', from: 0.33, speed: 1.5 },
        // K : 3-cut blade rush   ← + K : rising blade (anti-air)   → + K : flying kick
        bladeRush: { file: 'models/toji/model-animated.glb', clip: 'sword_regular_c_quaternius', speed: 1.7, rootMotion: 0.8, weapon: 'blade' },
        bladeRise: { file: 'models/toji/model-animated.glb', clip: 'sword_uppercut_quaternius', speed: 1.1, rootY: true, weapon: 'blade' },
        diveKick: { file: 'models/toji/model-animated.glb', clip: 'aerial_dive_kick', from: 0.15, speed: 1.6, rootMotion: 0.9 },
        // specials: S1 pistol, S2 teleport slash, S3 worm blade + neck cut
        gunShoot: { file: 'models/toji/model-animated.glb', clip: 'pistol_shoot_quaternius', speed: 1, weapon: 'gun' },
        phantomSlash: { file: 'models/toji/model-animated.glb', clip: 'sword_regular_c_quaternius', from: 0.4, speed: 1.5, weapon: 'blade' },
        // S3 (O): reach back for the worm's blade (held pose, slow motion) -> neck cut
        drawBlade: { file: 'models/toji/model-animated.glb', clip: 'sword_regular_c_quaternius', from: 0, speed: 0.08 },
        neckSlash: { file: 'models/toji/model-animated.glb', clip: 'sword_regular_c_quaternius', from: 0.5, speed: 1.6, weapon: 'blade' },
        slash: { file: 'models/toji/model-animated.glb', clip: 'sword_regular_c_quaternius', from: 0.45, speed: 1.6, weapon: 'blade' },
        // domain opening, win pose (the match intro uses the same walk-in + pose as Gojo / Sukuna)
        open: { file: 'models/toji/model-animated.glb', clip: 'idle_lookaround_loop_quaternius', speed: 1.2, loop: true },
        victory: { file: 'models/toji/model-animated.glb', clip: 'idle_impatient', speed: 1, loop: true },
      },
    },
    voice: { pitch: 0.7, rate: 0.95 },
    lines: {
      intro: { jp: '呪力なんざ要らねぇ。これで十分だ', en: "No cursed energy. Don't need it." },
      win: { jp: '悪いな。仕事なんでね', en: 'Nothing personal. Just business.' },
      domain: { jp: '零ノ檻', en: 'Zero Cage.' },
    },
  },
];
