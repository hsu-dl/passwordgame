/* Password Blaster — Design Switchboard
   One codebase. The switches below are the only difference between the
   versions shown in the webinar. Content and mechanic never change. */

// --- CONFIG ---------------------------------------------------------------
const CONFIG = { briefing: true, feedback: true, hud: true, fast: false, small: false };

const PRESETS = {
  full:     { briefing: true,  feedback: true,  hud: true, fast: false, small: false },
  stripped: { briefing: false, feedback: false, hud: true, fast: false, small: false },
  persona:  { briefing: true,  feedback: true,  hud: true, fast: true,  small: true  },
};

const TIMING = {
  normal: { fall: 6000, spawn: 1800 },
  fast:   { fall: 3200, spawn: 1000 },
};

// --- ELEMENTS -------------------------------------------------------------
const $ = id => document.getElementById(id);
const timeLeftDisplay = $('time-left'), livesLeftDisplay = $('lives-left'), scoreDisplay = $('score');
const passwordContainer = $('password-container'), gameOverScreen = $('game-over');
const finalScoreDisplay = $('final-score'), restartButton = $('restart-button');
const backgroundMusic = $('background-music'), errorSound = $('error-sound');
const instructionScreen = $('instruction-screen'), understoodButton = $('understood-button');
const startScreen = $('start-screen'), startButton = $('start-button');
const gameContainer = $('game-container'), gameInfo = $('game-info');
const feedbackOverlay = $('feedback-modal-overlay'), feedbackExplanation = $('feedback-explanation');
const continueButton = $('continue-button');
const panel = $('presenter-panel'), panelToggle = $('panel-toggle');
const launchButton = $('launch-button'), backToPanel = $('back-to-panel');
const SW = { briefing: $('sw-briefing'), feedback: $('sw-feedback'), hud: $('sw-hud'),
             fast: $('sw-fast'), small: $('sw-small') };

// --- STATE ----------------------------------------------------------------
let score = 0, lives = 3, timeLeft = 60;
let gameInterval, timerInterval, isPaused = false;

// --- PASSWORD LISTS -------------------------------------------------------
const weakPasswords = ['123456','password','12345678','qwerty','111111','admin','pass','123',
  'football','starwars','letmein','p@ssw0rd','user','guest','987654321','dragon','lisa88',
  'john1995','sunflower'];
const strongPasswords = ['j#fB&2LzP@9s','8@qR$zE!t7gY','Gk!p9#sA*3nD','vU7$mK*zL!2j','sW2*rF@eD!9b',
  '4h&zP@jK!vBq','cY8#sL!zP@g9','mZ!3kF@rP#s7','bT!9zP@jK#v2','xR@8sL#kP!gZ'];

// --- PANEL ----------------------------------------------------------------
function syncSwitchesFromConfig() {
  Object.keys(SW).forEach(k => { SW[k].checked = CONFIG[k]; });
}
function readSwitchesIntoConfig() {
  Object.keys(SW).forEach(k => { CONFIG[k] = SW[k].checked; });
}
function applyPreset(name) {
  Object.assign(CONFIG, PRESETS[name]);
  syncSwitchesFromConfig();
  document.querySelectorAll('.preset').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === name));
}
function showPanel() {
  stopAllTimers();
  backgroundMusic.pause();
  passwordContainer.innerHTML = '';
  [instructionScreen, startScreen, gameContainer, gameOverScreen].forEach(el => el.classList.add('hidden'));
  feedbackOverlay.classList.add('hidden');
  panel.classList.remove('hidden');
  syncSwitchesFromConfig();
}
function applyConfigToPage() {
  document.body.classList.toggle('small-text', CONFIG.small);
  gameInfo.classList.toggle('hidden', !CONFIG.hud);
}

// --- FLOW -----------------------------------------------------------------
function launch() {
  readSwitchesIntoConfig();
  applyConfigToPage();
  panel.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  if (CONFIG.briefing) {
    instructionScreen.classList.remove('hidden');
  } else {
    showStartScreen();
  }
}
function showStartScreen() {
  instructionScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
}
function startGame() {
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  gameContainer.classList.remove('hidden');
  applyConfigToPage();
  score = 0; lives = 3; timeLeft = 60;
  scoreDisplay.textContent = score;
  livesLeftDisplay.textContent = lives;
  timeLeftDisplay.textContent = timeLeft;
  passwordContainer.innerHTML = '';
  backgroundMusic.currentTime = 0;
  backgroundMusic.play().catch(e => console.log('music blocked:', e));
  resumeGame();
}
function updateTimer() {
  if (timeLeft <= 0 || lives <= 0) { endGame(); }
  else { timeLeft--; timeLeftDisplay.textContent = timeLeft; }
}

function createPassword() {
  if (isPaused) return;
  const t = CONFIG.fast ? TIMING.fast : TIMING.normal;
  const el = document.createElement('div');
  el.classList.add('password');
  const isWeak = Math.random() < 0.5;
  const list = isWeak ? weakPasswords : strongPasswords;
  el.textContent = list[Math.floor(Math.random() * list.length)];
  el.dataset.type = isWeak ? 'weak' : 'strong';
  el.style.top = '-50px';
  el.style.left = Math.random() * 85 + '%';
  el.style.animationDuration = (t.fall / 1000) + 's';
  passwordContainer.appendChild(el);
  setTimeout(() => {
    if (document.body.contains(el)) {
      if (el.dataset.type === 'weak') handleMistake('miss', el.textContent);
      el.remove();
    }
  }, t.fall);
}

function handlePasswordClick(event) {
  if (isPaused) return;
  const el = event.target;
  if (!el.classList.contains('password')) return;
  if (el.dataset.type === 'weak') {
    const shot = new Audio('shoot-sound.mp3');
    shot.play().catch(e => console.log('sfx blocked:', e));
    score += 10;
    scoreDisplay.textContent = score;
  } else {
    handleMistake('hit_strong', el.textContent);
  }
  el.remove();
}

/* The one place the versions diverge.
   Feedback ON  : pause, explain why it was a mistake, then continue.
   Feedback OFF : lose a life and carry on. The player is told they were
                  wrong, but never told what "wrong" meant. */
function handleMistake(mistakeType, password) {
  if (lives <= 0) return;
  if (CONFIG.feedback) {
    pauseGame();
    playErrorSoundAndLoseLife();
    showFeedbackModal(getExplanation(mistakeType, password));
  } else {
    playErrorSoundAndLoseLife();
  }
}

function getExplanation(mistakeType, password) {
  if (mistakeType === 'hit_strong') {
    return `You shot a STRONG password: "${password}". Good passwords should be a random mix of letters, numbers, and symbols. Don't shoot these!`;
  }
  if (mistakeType === 'miss') {
    if (/^\d+$/.test(password)) {
      return `You missed the WEAK password: "${password}". This is weak because it only contains numbers.`;
    }
    if (['password','qwerty','admin','123456','12345678'].includes(password)) {
      return `You missed the WEAK password: "${password}". This is one of the most common and easily hacked passwords in the world!`;
    }
    return `You missed the WEAK password: "${password}". This is weak because it's a simple, common word or pattern.`;
  }
  return 'A mistake was made. Pay attention to the rules!';
}

function showFeedbackModal(text) {
  feedbackExplanation.textContent = text;
  feedbackOverlay.classList.remove('hidden');
}
function stopAllTimers() { clearInterval(gameInterval); clearInterval(timerInterval); }
function pauseGame() {
  isPaused = true;
  stopAllTimers();
  document.querySelectorAll('.password').forEach(p => p.style.animationPlayState = 'paused');
}
function resumeGame() {
  isPaused = false;
  feedbackOverlay.classList.add('hidden');
  const t = CONFIG.fast ? TIMING.fast : TIMING.normal;
  stopAllTimers();
  gameInterval = setInterval(createPassword, t.spawn);
  timerInterval = setInterval(updateTimer, 1000);
  document.querySelectorAll('.password').forEach(p => p.style.animationPlayState = 'running');
}
function playErrorSoundAndLoseLife() {
  if (lives > 0) {
    errorSound.currentTime = 0;
    errorSound.play().catch(e => console.log('sfx blocked:', e));
    lives--;
    livesLeftDisplay.textContent = lives;
  }
  if (lives <= 0) setTimeout(() => endGame(), 100);
}
function endGame() {
  isPaused = true;
  stopAllTimers();
  backgroundMusic.pause();
  passwordContainer.innerHTML = '';
  gameContainer.classList.add('hidden');
  feedbackOverlay.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
  finalScoreDisplay.textContent = score;
}

// --- EVENTS ---------------------------------------------------------------
document.querySelectorAll('.preset').forEach(b =>
  b.addEventListener('click', () => applyPreset(b.dataset.preset)));
launchButton.addEventListener('click', launch);
understoodButton.addEventListener('click', showStartScreen);
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', () => { isPaused = false; startGame(); });
backToPanel.addEventListener('click', showPanel);
passwordContainer.addEventListener('click', handlePasswordClick);
continueButton.addEventListener('click', resumeGame);
panelToggle.addEventListener('click', showPanel);

document.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P') { showPanel(); return; }
  if (e.key === 'Escape') { showPanel(); return; }
  if (!panel.classList.contains('hidden')) {
    if (e.key === '1') applyPreset('full');
    if (e.key === '2') applyPreset('stripped');
    if (e.key === '3') applyPreset('persona');
    if (e.key === 'Enter') launch();
  }
});

applyPreset('full');
