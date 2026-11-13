const PREFERRED_GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_MODELS = [PREFERRED_GEMINI_MODEL, 'gemini-3.0-flash', 'gemini-2.5-flash'];

function generateLocalStudyBundle(rawText, studyBudget = 'deep') {
  const cleanedText = rawText.replace(/\s+/g, ' ').trim();
  if (!cleanedText) {
    return {
      summary: ['No study material was provided.'],
      notes: '# Study Notes\n\nNo material was supplied. Please add a topic or source text.',
      flashcards: [{ question: 'What topic would you like to study?', answer: 'Add your notes or uploaded material first.', exact_quote: '' }],
      quiz: [{
        id: 1,
        question: 'What would you like to review first?',
        options: ['Your main idea', 'A quick summary', 'A flashcard set', 'All of the above'],
        correct: 3,
        explanation: 'Start by adding material and then generate your bundle.',
        exact_quote: ''
      }]
    };
  }

  const sentences = cleanedText.split(/(?<=[.!?])\s+/).filter(sentence => sentence && sentence.trim().length > 20);
  const fallbackSentences = cleanedText.split(/\s+/).slice(0, 12).join(' ');
  const keyTerms = [...new Set(cleanedText.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4)
    .filter(word => !['about', 'after', 'before', 'these', 'those', 'there', 'their', 'which', 'would', 'using', 'study', 'topic', 'material', 'example'].includes(word))
  )].slice(0, 6);

  if (studyBudget === 'cram') {
    const sourceFacts = sentences.length ? sentences : [fallbackSentences];
    const summary = sourceFacts.slice(0, 5);
    const notes = [
      '# 10-Min Panic Cram Cheat-Sheet',
      '',
      '## High-yield source facts',
      ...summary.map(fact => `- ${fact}`),
      '',
      '## Keywords',
      ...(keyTerms.length ? keyTerms.map(term => `- ${term}`) : ['- Main idea']),
      '',
      '## Common exam traps',
      '- Check units, dates, and definitions before choosing an answer.',
      '- Watch for absolute words such as “always”, “never”, and “only”.',
      '- Do not confuse similar terms or reverse cause and effect.'
    ].join('\n');
    const flashcards = Array.from({ length: 6 }, (_, index) => {
      const quote = sourceFacts[index % sourceFacts.length];
      const term = keyTerms.length ? keyTerms[index % keyTerms.length] : 'the main idea';
      return {
        question: `Rapid recall ${index + 1}: What does the source say about "${term}"?`,
        answer: quote,
        exact_quote: quote
      };
    });
    const quiz = Array.from({ length: 5 }, (_, index) => {
      const quote = sourceFacts[index % sourceFacts.length];
      const isTrueFalse = index % 2 === 0;
      return {
        id: index + 1,
        question: isTrueFalse
          ? `True or False: The source states, "${quote}"`
          : `Which option matches the source detail?`,
        options: isTrueFalse
          ? ['True', 'False']
          : [quote.slice(0, 120), 'The source states the opposite.', 'The source does not mention this detail.', 'This detail is unrelated to the topic.'],
        correct: 0,
        explanation: 'Compare the statement with the quoted source detail; do not rely on a guessed fact.',
        exact_quote: quote
      };
    });
    return { summary, notes, flashcards, quiz };
  }

  const summary = (sentences.length ? sentences : [fallbackSentences]).slice(0, 3).map((sentence, index) => {
    const cleanedSentence = sentence.trim();
    if (index === 0) return cleanedSentence;
    return cleanedSentence.length > 120 ? `${cleanedSentence.slice(0, 110).trim()}...` : cleanedSentence;
  });

  const notes = [
    '# Study Notes',
    '',
    '## Overview',
    sentences[0] || fallbackSentences,
    '',
    '## Key Concepts',
    ...keyTerms.map(term => `- ${term.charAt(0).toUpperCase() + term.slice(1)}: a central idea or concept that deserves revision.`),
    '',
    '## Important Details',
    ...(sentences.length > 1 ? sentences.slice(1, Math.min(sentences.length, 4)).map((sentence, index) => `${index + 1}. ${sentence}`) : ['1. Review the full text carefully and pull out the main message.', '2. Try to explain the main idea in your own words.', '3. Connect each concept to a practical example.']),
    '',
    '## Quick Revision Tips',
    '- Break the topic into smaller ideas.',
    '- Summarize the main concept in 1-2 sentences.',
    '- Test yourself with the quiz and flashcards.'
  ].join('\n');

  const flashcards = [
    {
      question: 'What is the main idea of this content?',
      answer: sentences[0] || fallbackSentences,
      exact_quote: sentences[0] || fallbackSentences
    },
    ...keyTerms.slice(0, 3).map((term, index) => ({
      question: `What does "${term}" refer to in this material?`,
      answer: `It is a key concept from the source text and should be explained in your own words, using the topic context from the notes.`,
      exact_quote: sentences.find(sentence => sentence.toLowerCase().includes(term)) || sentences[0] || fallbackSentences
    }))
  ];

  const quiz = [
    {
      id: 1,
      question: 'Which option best captures the core idea of the material?',
      options: [
        (sentences[0] || fallbackSentences).slice(0, 80),
        'A random unrelated fact.',
        'A list of definitions without context.',
        'A summary that leaves out the main point.'
      ],
      correct: 0,
      explanation: 'The best answer reflects the actual main idea of the source material.',
      exact_quote: sentences[0] || fallbackSentences
    },
    {
      id: 2,
      question: 'Which statement is most useful for revision?',
      options: [
        'Explain the main concept in your own words.',
        'Ignore the examples.',
        'Memorize only one sentence.',
        'Skip the topic outline.'
      ],
      correct: 0,
      explanation: 'Revision works best when you restate the concept and link it to examples.',
      exact_quote: sentences[0] || fallbackSentences
    },
    {
      id: 3,
      question: 'What should you do after reading the material?',
      options: [
        'Break it into key concepts and review with questions.',
        'Delete the notes immediately.',
        'Start over without checking the main idea.',
        'Ignore any examples or details.'
      ],
      correct: 0,
      explanation: 'Good study practice is to break the topic into concepts and review it actively.',
      exact_quote: sentences[0] || fallbackSentences
    }
  ];

  return { summary, notes, flashcards, quiz };
}

async function callGemini(apiKey, contents, systemInstruction = '') {
  let lastError = 'Gemini request failed.';

  for (const model of GEMINI_MODELS) {
    const requestBody = { contents };
    if (systemInstruction) requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok && !data.error) {
      return { data, model };
    }

    lastError = data.error?.message || `HTTP Error ${response.status}`;
  }

  throw new Error(lastError);
}

let currentSourceTab = 'text';
let currentOutputTab = 'summary';
let loadedFileData = null;
let selectedStudyBudget = 'deep';
let sourceMaterialText = '';
let sourcePayloadContents = [];
let calmAudioContext = null;
let calmAudioNodes = null;
let calmSoundscapePlaying = false;
let calmAudioTrack = 'piano';
let pianoScheduler = null;
let pianoNoteIndex = 0;
let nextPianoNoteAt = 0;
let breathingInterval = null;
let breathingStartedAt = 0;
let sprintInterval = null;
let sprintRemainingSeconds = 600;
let sprintDeadline = 0;
let sprintRunning = false;

let generatedData = {
  summary: [],
  notes: '',
  flashcards: [],
  quiz: []
};
let hasGeneratedData = false;
let aiModeLabel = 'Local mode';

let currentCardIndex = 0;
let isCardFlipped = false;
let quizAnswers = {};
let weakTopics = [];
let remediationSignature = '';
let remediationData = [];
let sessions = JSON.parse(localStorage.getItem('easyPeasy_sessions') || '[]');
let activeSessionId = localStorage.getItem('easyPeasy_active_session') || null;

// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initializeSessions();
  setOutputTab('summary');
});

function setSourceTab(type) {
  currentSourceTab = type;
  ['text', 'file', 'link'].forEach(t => {
    const tab = document.getElementById(`tab-${t}`);
    const container = document.getElementById(`input-${t}-container`);
    if (t === type) {
      tab.classList.add('active');
      tab.setAttribute('aria-pressed', 'true');
      container.classList.remove('hidden');
      if (t === 'file' || t === 'link') container.classList.add('flex');
    } else {
      tab.classList.remove('active');
      tab.setAttribute('aria-pressed', 'false');
      container.classList.add('hidden');
      if (t === 'file' || t === 'link') container.classList.remove('flex');
    }
  });
}

function setOutputTab(type) {
  currentOutputTab = type;
  ['summary', 'notes', 'flashcards', 'quiz'].forEach(t => {
    const tab = document.getElementById(`out-tab-${t}`);
    const sec = document.getElementById(`section-${t}`);
    if (t === type) {
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.classList.remove('active');
      tab.removeAttribute('aria-current');
    }
    sec.classList.toggle('hidden', !(t === type && hasGeneratedData));
  });
}

function setStudyBudget(mode) {
  if (!['cram', 'deep', 'exam'].includes(mode)) return;
  const previousMode = selectedStudyBudget;
  selectedStudyBudget = mode;
  document.getElementById('cram-countdown-badge').hidden = mode !== 'cram';
  document.getElementById('panic-calm-toolkit').hidden = mode !== 'cram';
  document.querySelectorAll('.budget-pill').forEach(button => {
    const active = button.dataset.budget === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (previousMode === 'cram' && mode !== 'cram') {
    stopBreathingGuide();
    pauseCramSprint();
    pauseCalmSoundscape();
  }
}

function createCalmSoundscape() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is not supported in this browser.');

  const context = new AudioContextConstructor();
  const master = context.createGain();
  master.gain.value = Number(document.getElementById('calm-volume').value) / 100 * 1.1;
  const fade = context.createGain();
  fade.gain.value = 0;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 18;
  compressor.ratio.value = 2.2;
  compressor.attack.value = 0.012;
  compressor.release.value = 0.32;
  master.connect(fade);
  fade.connect(compressor);
  const outputGain = context.createGain();
  outputGain.gain.value = 1;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 4;
  limiter.ratio.value = 10;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  compressor.connect(outputGain);
  outputGain.connect(limiter);
  const spatialPanner = context.createStereoPanner();
  limiter.connect(spatialPanner);
  spatialPanner.connect(context.destination);
  const orbitOscillator = context.createOscillator();
  const orbitDepth = context.createGain();
  orbitOscillator.frequency.value = 0.045;
  orbitDepth.gain.value = 0.9;
  orbitOscillator.connect(orbitDepth);
  orbitDepth.connect(spatialPanner.pan);
  orbitOscillator.start();

  const padFilter = context.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 1200;
  padFilter.Q.value = 0.7;
  const padGain = context.createGain();
  padGain.gain.value = 0.18;
  padFilter.connect(padGain);
  padGain.connect(master);

  const padOscillators = [130.81, 164.81, 196].map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 2 ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index * 3 - 3;
    oscillator.connect(padFilter);
    oscillator.start();
    return oscillator;
  });
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain);
  lfoGain.connect(padGain.gain);
  lfo.start();

  const noiseBuffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseData.length; index++) {
    noiseData[index] = Math.random() * 2 - 1;
  }
  const edgeSamples = Math.floor(context.sampleRate * 0.04);
  for (let index = 0; index < edgeSamples; index++) {
    const fade = 0.5 - 0.5 * Math.cos(Math.PI * index / edgeSamples);
    noiseData[index] *= fade;
    noiseData[noiseData.length - 1 - index] *= fade;
  }
  const rainSource = context.createBufferSource();
  rainSource.buffer = noiseBuffer;
  rainSource.loop = true;
  const rainHighPass = context.createBiquadFilter();
  rainHighPass.type = 'highpass';
  rainHighPass.frequency.value = 260;
  const rainLowPass = context.createBiquadFilter();
  rainLowPass.type = 'lowpass';
  rainLowPass.frequency.value = 2800;
  const rainGain = context.createGain();
  rainGain.gain.value = 0.07;
  const pianoTrackGain = context.createGain();
  pianoTrackGain.gain.value = calmAudioTrack === 'piano' ? 1 : 0;
  const lofiTrackGain = context.createGain();
  lofiTrackGain.gain.value = calmAudioTrack === 'lofi' ? 1 : 0;
  rainSource.connect(rainHighPass);
  rainHighPass.connect(rainLowPass);
  rainLowPass.connect(rainGain);
  rainGain.connect(lofiTrackGain);
  pianoTrackGain.connect(master);
  lofiTrackGain.connect(master);
  rainSource.start();

  calmAudioContext = context;
  calmAudioNodes = { master, fade, compressor, outputGain, limiter, spatialPanner, orbitOscillator, orbitDepth, padOscillators, lfo, rainSource, pianoTrackGain, lofiTrackGain };
}

const calmPianoNotes = [
  { name: 'C4', frequency: 261.63 },
  { name: 'E4', frequency: 329.63 },
  { name: 'G4', frequency: 392 },
  { name: 'B4', frequency: 493.88 },
  { name: 'A3', frequency: 220 },
  { name: 'D4', frequency: 293.66 },
  { name: 'F4', frequency: 349.23 },
  { name: 'E4', frequency: 329.63 }
];

function playSoftPianoNote(frequency, startAt) {
  if (!calmAudioContext || !calmAudioNodes) return;
  const context = calmAudioContext;
  const voiceGain = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2600, startAt);
  filter.frequency.exponentialRampToValueAtTime(1100, startAt + 1.8);
  voiceGain.gain.setValueAtTime(0.0001, startAt);
  voiceGain.gain.linearRampToValueAtTime(0.13, startAt + 0.06);
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.8);
  filter.connect(voiceGain);
  voiceGain.connect(calmAudioNodes.pianoTrackGain);

  [[1, 0.82, 1.8], [2.01, 0.14, 0.9], [3.98, 0.025, 0.45]].forEach(([partial, level, decay]) => {
    const oscillator = context.createOscillator();
    const partialGain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency * partial, startAt);
    partialGain.gain.setValueAtTime(level, startAt);
    partialGain.gain.exponentialRampToValueAtTime(0.0001, startAt + decay);
    oscillator.connect(partialGain);
    partialGain.connect(filter);
    oscillator.start(startAt);
    oscillator.stop(startAt + 1.9);
  });
}

function updatePianoPadChord(noteIndex, at) {
  if (!calmAudioNodes || noteIndex % 4 !== 0) return;
  const chord = noteIndex % 8 === 0
    ? [130.81, 164.81, 196]
    : [110, 130.81, 164.81];
  calmAudioNodes.padOscillators.forEach((oscillator, index) => {
    oscillator.frequency.setTargetAtTime(chord[index], at, 0.35);
  });
}

function startPianoMelody() {
  if (!calmAudioContext || !calmSoundscapePlaying || calmAudioTrack !== 'piano' || pianoScheduler) return;
  nextPianoNoteAt = calmAudioContext.currentTime + 0.12;
  pianoScheduler = window.setInterval(() => {
    if (!calmSoundscapePlaying || calmAudioTrack !== 'piano') {
      stopPianoMelody();
      return;
    }
    const now = calmAudioContext.currentTime;
    const earliestNoteAt = now + 0.05;
    if (nextPianoNoteAt < earliestNoteAt) {
      const missedNotes = Math.ceil((earliestNoteAt - nextPianoNoteAt) / 1.1);
      pianoNoteIndex += missedNotes;
      nextPianoNoteAt += missedNotes * 1.1;
    }
    const scheduleUntil = now + 0.25;
    while (nextPianoNoteAt < scheduleUntil) {
      const note = calmPianoNotes[pianoNoteIndex % calmPianoNotes.length];
      updatePianoPadChord(pianoNoteIndex, nextPianoNoteAt);
      playSoftPianoNote(note.frequency, nextPianoNoteAt);
      pianoNoteIndex += 1;
      nextPianoNoteAt += 1.1;
    }
  }, 100);
}

function stopPianoMelody() {
  if (pianoScheduler) {
    window.clearInterval(pianoScheduler);
    pianoScheduler = null;
  }
}

function setCalmAudioTrack(track) {
  if (!['piano', 'lofi'].includes(track)) return;
  calmAudioTrack = track;
  document.querySelectorAll('[data-audio-track]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.audioTrack === track));
  });
  if (!calmAudioNodes || !calmAudioContext) return;
  const now = calmAudioContext.currentTime;
  const pianoGain = calmAudioNodes.pianoTrackGain.gain;
  const lofiGain = calmAudioNodes.lofiTrackGain.gain;
  [pianoGain, lofiGain].forEach(gain => gain.cancelScheduledValues(now));
  if (calmSoundscapePlaying) {
    pianoGain.setValueAtTime(pianoGain.value, now);
    lofiGain.setValueAtTime(lofiGain.value, now);
    pianoGain.linearRampToValueAtTime(track === 'piano' ? 1 : 0, now + 0.7);
    lofiGain.linearRampToValueAtTime(track === 'lofi' ? 1 : 0, now + 0.7);
  } else {
    pianoGain.setValueAtTime(track === 'piano' ? 1 : 0, now);
    lofiGain.setValueAtTime(track === 'lofi' ? 1 : 0, now);
  }
  if (track === 'piano') startPianoMelody();
  else stopPianoMelody();
}

function setCalmSoundVolume(value) {
  const volume = Math.max(0, Math.min(100, Number(value)));
  document.getElementById('calm-volume-value').textContent = `${Math.round(volume)}%`;
  if (calmAudioNodes && calmAudioContext) {
    calmAudioNodes.master.gain.setTargetAtTime(volume / 100 * 1.1, calmAudioContext.currentTime, 0.08);
  }
}

function updateSoundscapeControls() {
  const button = document.getElementById('soundscape-toggle');
  button.textContent = calmSoundscapePlaying ? 'Pause Soundscape' : 'Play Calm Soundscape';
  button.setAttribute('aria-pressed', String(calmSoundscapePlaying));
  document.getElementById('soundscape-status').textContent = calmSoundscapePlaying
    ? 'Calm soundscape is playing.'
    : 'Calm soundscape is paused.';
}

async function toggleCalmSoundscape() {
  const button = document.getElementById('soundscape-toggle');
  button.disabled = true;
  try {
    if (!calmAudioContext) createCalmSoundscape();
    if (calmSoundscapePlaying) {
      stopPianoMelody();
      const now = calmAudioContext.currentTime;
      calmAudioNodes.fade.gain.cancelScheduledValues(now);
      calmAudioNodes.fade.gain.setValueAtTime(calmAudioNodes.fade.gain.value, now);
      calmAudioNodes.fade.gain.linearRampToValueAtTime(0, now + 0.7);
      await new Promise(resolve => window.setTimeout(resolve, 750));
      await calmAudioContext.suspend();
      calmSoundscapePlaying = false;
    } else {
      await calmAudioContext.resume();
      if (calmAudioContext.state !== 'running') {
        throw new Error('The browser kept audio paused. Check browser/site audio permissions and your output volume.');
      }
      const now = calmAudioContext.currentTime;
      calmAudioNodes.fade.gain.cancelScheduledValues(now);
      calmAudioNodes.fade.gain.setValueAtTime(0, now);
      calmAudioNodes.fade.gain.linearRampToValueAtTime(1, now + 0.8);
      calmSoundscapePlaying = true;
      if (calmAudioTrack === 'piano') startPianoMelody();
    }
    updateSoundscapeControls();
  } catch (error) {
    calmSoundscapePlaying = false;
    stopPianoMelody();
    updateSoundscapeControls();
    showUploadMessage(`Could not start the calm soundscape: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

async function pauseCalmSoundscape() {
  if (!calmAudioContext || !calmSoundscapePlaying) return;
  try {
    stopPianoMelody();
    const now = calmAudioContext.currentTime;
    calmAudioNodes.fade.gain.cancelScheduledValues(now);
    calmAudioNodes.fade.gain.setValueAtTime(calmAudioNodes.fade.gain.value, now);
    calmAudioNodes.fade.gain.linearRampToValueAtTime(0, now + 0.7);
    await new Promise(resolve => window.setTimeout(resolve, 750));
    await calmAudioContext.suspend();
    calmSoundscapePlaying = false;
    updateSoundscapeControls();
  } catch (error) {
    showUploadMessage(`Could not pause the calm soundscape: ${error.message}`, 'error');
  }
}

function updateBreathingDisplay() {
  const elapsed = Math.floor((Date.now() - breathingStartedAt) / 1000) % 19;
  let phase;
  let secondsLeft;
  if (elapsed < 4) {
    phase = 'Inhale';
    secondsLeft = 4 - elapsed;
  } else if (elapsed < 11) {
    phase = 'Hold';
    secondsLeft = 11 - elapsed;
  } else {
    phase = 'Exhale';
    secondsLeft = 19 - elapsed;
  }
  const phaseLabel = document.getElementById('breath-phase');
  phaseLabel.firstChild.nodeValue = `${phase} `;
  document.getElementById('breath-countdown').textContent = `${secondsLeft}s`;
  document.getElementById('breath-orb').textContent = phase;
}

function toggleBreathingGuide() {
  if (breathingInterval) {
    stopBreathingGuide();
    return;
  }
  breathingStartedAt = Date.now();
  document.getElementById('breath-orb').classList.add('breathing-active');
  document.getElementById('breath-toggle').textContent = 'Pause breathing guide';
  document.getElementById('breath-toggle').setAttribute('aria-pressed', 'true');
  updateBreathingDisplay();
  breathingInterval = setInterval(updateBreathingDisplay, 250);
}

function stopBreathingGuide() {
  if (!breathingInterval) return;
  clearInterval(breathingInterval);
  breathingInterval = null;
  const orb = document.getElementById('breath-orb');
  const button = document.getElementById('breath-toggle');
  orb.classList.remove('breathing-active');
  button.textContent = 'Start breathing guide';
  button.setAttribute('aria-pressed', 'false');
  document.getElementById('breath-phase').firstChild.nodeValue = 'Ready ';
  document.getElementById('breath-countdown').textContent = '4s';
  orb.textContent = 'Breathe';
}

function updateSprintDisplay() {
  const minutes = Math.floor(sprintRemainingSeconds / 60);
  const seconds = sprintRemainingSeconds % 60;
  document.getElementById('sprint-countdown').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateCramSprint() {
  sprintRemainingSeconds = Math.max(0, Math.ceil((sprintDeadline - Date.now()) / 1000));
  updateSprintDisplay();
  if (sprintRemainingSeconds === 0) {
    clearInterval(sprintInterval);
    sprintInterval = null;
    sprintRunning = false;
    document.getElementById('sprint-toggle').textContent = 'Start another sprint';
    document.getElementById('sprint-status').textContent = 'Sprint complete. Take a short break, then review your weak spots.';
    showUploadMessage('Your 10-minute Panic Cram sprint is complete.', 'success');
  }
}

function toggleCramSprint() {
  if (sprintRunning) {
    pauseCramSprint();
    return;
  }
  if (sprintRemainingSeconds === 0) sprintRemainingSeconds = 600;
  sprintDeadline = Date.now() + sprintRemainingSeconds * 1000;
  sprintRunning = true;
  document.getElementById('sprint-toggle').textContent = 'Pause sprint';
  document.getElementById('sprint-status').textContent = 'Sprint in progress. Focus on the next small step.';
  sprintInterval = setInterval(updateCramSprint, 200);
  updateCramSprint();
}

function pauseCramSprint() {
  if (!sprintRunning) return;
  updateCramSprint();
  if (!sprintRunning) return;
  clearInterval(sprintInterval);
  sprintInterval = null;
  sprintRunning = false;
  document.getElementById('sprint-toggle').textContent = 'Resume sprint';
  document.getElementById('sprint-status').textContent = 'Sprint paused. Resume when you are ready.';
}

function resetCramSprint() {
  if (sprintInterval) clearInterval(sprintInterval);
  sprintInterval = null;
  sprintRunning = false;
  sprintRemainingSeconds = 600;
  updateSprintDisplay();
  document.getElementById('sprint-toggle').textContent = 'Start sprint';
  document.getElementById('sprint-status').textContent = 'Start when you feel ready.';
}

function getStudyBudgetGuidance() {
  const guidance = {
    cram: 'MODE: 10-MIN PANIC CRAM. Ignore fluff and lengthy background. Put the 5 most exam-critical formulas, dates, rules, or definitions in the Summary; use only source-supported facts, and do not invent facts to fill a gap. Format Notes as an ultra-condensed Cheat-Sheet with high-yield bullets, keywords, and common exam traps. Generate exactly 6 rapid-fire flashcards and exactly 5 speed-quiz questions, using True/False or tricky multiple choice to test common student misconceptions. Keep the whole set answerable in under 10 minutes.',
    deep: 'MODE: 1-HOUR DEEP DIVE. Provide thorough, structured conceptual notes with clear examples, useful flashcards, and a balanced quiz from recall to application.',
    exam: 'MODE: UNIVERSITY EXAM BANK. Emphasize rigorous university-level exam preparation, precise definitions, common misconceptions, and a broad question bank with plausible distractors.'
  };
  return guidance[selectedStudyBudget];
}

function normalizeStudyBundle(data) {
  if (!data || typeof data !== 'object') throw new Error('The study bundle was not a JSON object.');
  const summary = Array.isArray(data.summary) ? data.summary.map(String) : [];
  const flashcards = Array.isArray(data.flashcards) ? data.flashcards.map(card => ({
    question: String(card?.question || ''),
    answer: String(card?.answer || ''),
    exact_quote: String(card?.exact_quote || ''),
    needsReview: Boolean(card?.needsReview)
  })).filter(card => card.question && card.answer) : [];
  const quiz = Array.isArray(data.quiz) ? data.quiz.map((question, index) => {
    const options = Array.isArray(question?.options) ? question.options.map(String) : [];
    const requestedCorrect = Number(question?.correct);
    const correct = Number.isInteger(requestedCorrect) && requestedCorrect >= 0 && requestedCorrect < options.length ? requestedCorrect : 0;
    return {
      id: question?.id ?? index + 1,
      question: String(question?.question || ''),
      options,
      correct,
      explanation: String(question?.explanation || ''),
      exact_quote: String(question?.exact_quote || '')
    };
  }).filter(question => question.question && question.options.length > 1) : [];
  if (!summary.length && !data.notes && !flashcards.length && !quiz.length) {
    throw new Error('The study bundle did not include any usable study outputs.');
  }
  return { summary, notes: String(data.notes || ''), flashcards, quiz };
}

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const label = document.getElementById('file-name-label');
  const allowed = file.type === 'application/pdf' || file.type.startsWith('image/');
  const maxSize = 10 * 1024 * 1024;

  try {
    if (!allowed) throw new Error('Please choose a PDF, JPG, PNG, GIF, or WEBP image.');
    if (file.size > maxSize) throw new Error('That file is larger than 10 MB. Please choose a smaller file.');
    label.textContent = `Reading ${file.name}…`;

    if (file.type === 'application/pdf') {
      const text = await extractPdfText(file);
      loadedFileData = { type: 'text', content: text, name: file.name };
    } else {
      const base64 = await fileToBase64(file);
      loadedFileData = { type: 'image', content: base64, mimeType: file.type, name: file.name };
    }
    label.textContent = file.name;
    showUploadMessage(`Attached ${file.name}`, 'success');
  } catch (error) {
    loadedFileData = null;
    event.target.value = '';
    label.textContent = 'Upload PDF or image';
    showUploadMessage(error.message, 'error');
  }
}

function extractPdfText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => item.str || '').join(' ') + '\n';
        }
        if (fullText.trim()) {
          resolve(fullText);
        } else {
          resolve(await ocrPdf(pdf));
        }
      } catch (error) {
        reject(new Error('Could not read this PDF. Please try another file.'));
      }
    };
    reader.onerror = () => reject(new Error('The file could not be read. Please try again.'));
    reader.readAsArrayBuffer(file);
  });
}

async function ocrPdf(pdf) {
  if (typeof Tesseract === 'undefined') {
    throw new Error('OCR support is still loading. Please try the PDF again in a moment.');
  }
  let fullText = '';
  let worker;
  try {
    worker = await Tesseract.createWorker('eng', 1, {
      logger: progress => {
        if (progress.status === 'recognizing text') {
          showUploadMessage(`Reading scanned PDF… ${Math.round(progress.progress * 100)}%`);
        }
      }
    });
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      showUploadMessage(`Reading scanned PDF page ${pageNumber} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const result = await worker.recognize(canvas);
      fullText += `${result.data.text}\n`;
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    if (worker) await worker.terminate();
  }
  if (!fullText.trim()) throw new Error('No readable text was found in this scanned PDF.');
  return fullText;
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
}

async function generateStudyBundle() {
  let payloadContents = [];
  let rawText = '';

  if (currentSourceTab === 'text') {
    rawText = document.getElementById('raw-text-input').value.trim();
    if (!rawText) return alert('Please enter some text content.');
    payloadContents = [{ role: "user", parts: [{ text: rawText }] }];
  } else if (currentSourceTab === 'file') {
    if (!loadedFileData) return alert('Please upload a file.');
    if (loadedFileData.type === 'text') {
      rawText = loadedFileData.content;
      payloadContents = [{ role: "user", parts: [{ text: rawText }] }];
    } else {
      rawText = 'Study material uploaded as an image.';
      payloadContents = [{
        role: "user",
        parts: [
          { inline_data: { mime_type: loadedFileData.mimeType, data: loadedFileData.content } },
          { text: "Analyze this study material image and extract key educational content." }
        ]
      }];
    }
  } else if (currentSourceTab === 'link') {
    const url = document.getElementById('link-input').value.trim();
    if (!url) return alert('Please enter a valid link.');
    rawText = `Study material web link: ${url}`;
    payloadContents = [{ role: "user", parts: [{ text: rawText }] }];
  }

  sourceMaterialText = rawText;
  sourcePayloadContents = payloadContents.map(content => ({ ...content, parts: content.parts.slice() }));
  const promptText = `
Analyze the provided study material. Study pace: ${getStudyBudgetGuidance()}
Return ONLY a valid JSON object (without markdown code blocks) formatted strictly as follows:
{
  "summary": ["Exam-critical item 1", "Exam-critical item 2"],
  "notes": "Full structured markdown study notes with headers and key concept explanations.",
  "flashcards": [
    {"question": "Question", "answer": "Answer", "exact_quote": "An exact verbatim supporting quote from the source"}
  ],
  "quiz": [
    {
      "id": 1,
      "question": "Question text?",
      "options": ["Opt A", "Opt B", "Opt C", "Opt D"],
      "correct": 0,
      "explanation": "Why this answer is correct.",
      "exact_quote": "An exact verbatim supporting quote from the source"
    }
  ]
}
For every flashcard and quiz question, exact_quote must be copied verbatim from the provided material and directly support the answer. Never invent or paraphrase a quote; use an empty string when no exact supporting quote exists. Match the requested study pace while keeping all questions grounded in the source.
`;

  payloadContents[0].parts.push({ text: promptText });

  document.getElementById('loading-spinner').hidden = false;
  document.getElementById('generate-btn').disabled = true;
  weakTopics = [];
  document.getElementById('weak-spots-panel').hidden = true;

  try {
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    if (apiKey.trim()) {
      const { data } = await callGemini(apiKey, payloadContents, getStudyBudgetGuidance());

      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error("The AI returned an empty response. Try a different file or text.");
      }

      const rawResponse = data.candidates[0].content.parts[0].text;
      generatedData = normalizeStudyBundle(parseGeminiJson(rawResponse));
      aiModeLabel = 'Gemini mode';
      renderOutputs();
      return;
    }

    aiModeLabel = 'Local mode';
    generatedData = normalizeStudyBundle(generateLocalStudyBundle(rawText, selectedStudyBudget));
    showUploadMessage('Using Local mode. Add a Gemini API key for AI-generated study materials.', 'info');
    renderOutputs();
  } catch (err) {
    aiModeLabel = 'Local mode';
    showUploadMessage(`Gemini could not create the bundle (${err.message}). Using Local mode instead.`, 'error');
    generatedData = normalizeStudyBundle(generateLocalStudyBundle(rawText, selectedStudyBudget));
    renderOutputs();
  } finally {
    document.getElementById('loading-spinner').hidden = true;
    document.getElementById('generate-btn').disabled = false;
  }
}

function parseGeminiJson(responseText) {
  const cleaned = responseText.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Gemini did not return valid JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function renderOutputs() {
  hasGeneratedData = true;
  document.getElementById('empty-state').classList.add('hidden');

  const modeLabelEl = document.getElementById('ai-mode-label');
  if (modeLabelEl) {
    modeLabelEl.textContent = aiModeLabel;
  }

  const summaryBox = document.getElementById('summary-content');
  summaryBox.innerHTML = generatedData.summary.map(s => `<p><span style="color:var(--accent);font-weight:800">•</span> ${escapeHtml(s)}</p>`).join('');
  document.getElementById('notes-content').textContent = generatedData.notes;

  currentCardIndex = 0;
  quizAnswers = {};
  document.getElementById('quiz-score').textContent = 'Score: -';
  updateFlashcardView();
  renderQuiz();
  updateWeakSpotControls();
  setOutputTab(currentOutputTab);
}

function updateFlashcardView() {
  if (!generatedData.flashcards.length) return;
  const card = generatedData.flashcards[currentCardIndex];
  document.getElementById('flashcard-q').textContent = card.question;
  document.getElementById('flashcard-a').textContent = card.answer;
  document.getElementById('flashcard-counter').textContent = `Card ${currentCardIndex + 1} of ${generatedData.flashcards.length}`;
  const reviewButton = document.getElementById('flashcard-review-btn');
  reviewButton.textContent = card.needsReview ? 'Marked Needs Review' : 'Mark Needs Review';
  reviewButton.classList.toggle('active', card.needsReview);
  const citation = document.getElementById('flashcard-citation');
  citation.textContent = card.exact_quote || 'No exact supporting quote was returned for this flashcard.';
  citation.hidden = true;
  isCardFlipped = false;
  document.getElementById('flashcard-inner').classList.remove('flipped');
}

function flipFlashcard() {
  isCardFlipped = !isCardFlipped;
  document.getElementById('flashcard-inner').classList.toggle('flipped', isCardFlipped);
}

function toggleFlashcardReview() {
  const card = generatedData.flashcards[currentCardIndex];
  if (!card) return;
  card.needsReview = !card.needsReview;
  updateFlashcardView();
  updateWeakSpotControls();
}

function toggleCitation(elementId) {
  const citation = document.getElementById(elementId);
  if (citation) citation.hidden = !citation.hidden;
}

function nextFlashcard() {
  if (currentCardIndex < generatedData.flashcards.length - 1) {
    currentCardIndex++;
    updateFlashcardView();
  }
}

function prevFlashcard() {
  if (currentCardIndex > 0) {
    currentCardIndex--;
    updateFlashcardView();
  }
}

function renderQuiz() {
  const container = document.getElementById('quiz-container');
  container.innerHTML = generatedData.quiz.map((q, idx) => `
    <article class="quiz-question">
      <p class="quiz-question-title">${idx + 1}. ${escapeHtml(q.question)}</p>
      <div class="quiz-options">
        ${q.options.map((opt, oIdx) => `
          <button onclick="selectOption(${idx}, ${oIdx})" id="q-${idx}-opt-${oIdx}" class="quiz-option">
            ${escapeHtml(opt)}
          </button>
        `).join('')}
      </div>
      <div id="q-${idx}-exp" class="quiz-explanation" role="status" aria-live="polite" hidden></div>
      <div class="quiz-citation-wrap" style="margin-top:10px">
        <button onclick="toggleCitation('q-${idx}-quote')" class="citation-button">Verify Source</button>
        <blockquote id="q-${idx}-quote" class="citation-quote quiz-quote" hidden>${escapeHtml(q.exact_quote || 'No exact supporting quote was returned for this question.')}</blockquote>
      </div>
    </article>
  `).join('');
}

function selectOption(qIdx, oIdx) {
  const q = generatedData.quiz[qIdx];
  if (!q || quizAnswers[qIdx] !== undefined || !q.options[oIdx]) return;
  quizAnswers[qIdx] = oIdx;
  const isCorrect = oIdx === q.correct;

  q.options.forEach((_, optIndex) => {
    const btn = document.getElementById(`q-${qIdx}-opt-${optIndex}`);
    btn.disabled = true;
    if (optIndex === q.correct) {
      btn.classList.add('correct');
    } else if (optIndex === oIdx && oIdx !== q.correct) {
      btn.classList.add('incorrect');
    }
  });

  showQuizFeedback(`q-${qIdx}-exp`, isCorrect, q.options[q.correct], q.explanation);
  updateWeakSpotControls();
  updateQuizScore();
}

function showQuizFeedback(elementId, isCorrect, correctAnswer, explanation) {
  const container = document.getElementById(elementId);
  container.replaceChildren();

  const result = document.createElement('strong');
  result.className = isCorrect ? 'quiz-feedback-correct' : 'quiz-feedback-incorrect';
  result.textContent = isCorrect ? 'Correct!' : 'Incorrect.';
  container.append(result, document.createTextNode(' '));

  if (!isCorrect) {
    const answerLine = document.createElement('p');
    answerLine.className = 'quiz-correct-answer';
    const answerLabel = document.createElement('strong');
    answerLabel.textContent = 'Correct answer: ';
    answerLine.append(answerLabel, document.createTextNode(correctAnswer));
    container.append(answerLine);
  }

  if (explanation) {
    const explanationLine = document.createElement('p');
    explanationLine.className = 'quiz-answer-explanation';
    explanationLine.textContent = explanation;
    container.append(explanationLine);
  }

  container.hidden = false;
}

function updateQuizScore() {
  let correctCount = 0;
  Object.keys(quizAnswers).forEach(qIdx => {
    if (quizAnswers[qIdx] === generatedData.quiz[qIdx].correct) correctCount++;
  });
  document.getElementById('quiz-score').textContent = `Score: ${correctCount} / ${generatedData.quiz.length}`;
}

function updateWeakSpotControls() {
  weakTopics = [];
  generatedData.quiz.forEach((question, index) => {
    if (quizAnswers[index] !== undefined && quizAnswers[index] !== question.correct) {
      weakTopics.push({
        kind: 'quiz',
        title: question.question,
        explanation: question.explanation,
        answer: question.options[question.correct] || question.explanation,
        quote: question.exact_quote || ''
      });
    }
  });
  generatedData.flashcards.forEach(card => {
    if (card.needsReview) {
      weakTopics.push({
        kind: 'flashcard',
        title: card.question,
        explanation: card.answer,
        answer: card.answer,
        quote: card.exact_quote || ''
      });
    }
  });
  const signature = JSON.stringify(weakTopics.map(topic => [topic.kind, topic.title]));
  if (signature !== remediationSignature) {
    remediationSignature = signature;
    remediationData = [];
    document.getElementById('weak-spots-panel').hidden = true;
  }
  const button = document.getElementById('fix-weak-spots-btn');
  button.hidden = weakTopics.length === 0;
  button.textContent = `Fix My Weak Spots (${weakTopics.length})`;
}

function createLocalRemediationSet(topics) {
  return topics.map((topic, index) => ({
    topic: topic.title,
    simple_explanation: topic.explanation || topic.answer,
    follow_up_question: `Which idea from your source best answers: ${topic.title}`,
    options: [
      topic.answer || topic.explanation,
      'A detail that is not supported by the source.',
      'The opposite of the source’s main point.',
      'An unrelated idea from another topic.'
    ],
    correct: 0,
    explanation: 'Use the source detail and explanation above to connect this idea again.',
    exact_quote: topic.quote || ''
  }));
}

function normalizeRemediationSet(data) {
  if (!data || !Array.isArray(data.items)) throw new Error('The weak-spot response did not contain an items list.');
  return data.items.map(item => ({
    topic: String(item?.topic || ''),
    simple_explanation: String(item?.simple_explanation || ''),
    follow_up_question: String(item?.follow_up_question || ''),
    options: Array.isArray(item?.options) ? item.options.map(String) : [],
    correct: Number.isInteger(Number(item?.correct)) ? Number(item.correct) : 0,
    explanation: String(item?.explanation || ''),
    exact_quote: String(item?.exact_quote || '')
  })).filter(item => item.topic && item.simple_explanation && item.follow_up_question && item.options.length > 1)
    .map(item => ({ ...item, correct: item.correct >= 0 && item.correct < item.options.length ? item.correct : 0 }));
}

async function generateWeakSpotSet() {
  if (!weakTopics.length) return;
  const button = document.getElementById('fix-weak-spots-btn');
  button.disabled = true;
  button.textContent = 'Building focused practice…';
  try {
    const apiKey = localStorage.getItem('gemini_api_key')?.trim();
    if (apiKey) {
      const contents = sourcePayloadContents.map(content => ({ ...content, parts: content.parts.slice() }));
      const focus = weakTopics.map((topic, index) => `${index + 1}. ${topic.kind}: ${topic.title}; explanation/answer: ${topic.explanation}; source quote: ${topic.quote || '(none)'}`).join('\n');
      contents[0].parts.push({ text: `
Create a targeted remediation mini-set only for the learner's weak topics below, grounded in the supplied source. Use simpler explanations than the original and one clear follow-up multiple-choice question per weak topic. Do not add unrelated topics. Return ONLY JSON:
{"items":[{"topic":"...","simple_explanation":"...","follow_up_question":"...","options":["...","...","...","..."],"correct":0,"explanation":"...","exact_quote":"..."}]}
exact_quote must be copied verbatim from the source or be an empty string. Weak topics:
${focus}
` });
      const { data } = await callGemini(apiKey, contents);
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error('Gemini returned an empty weak-spot set.');
      remediationData = normalizeRemediationSet(parseGeminiJson(responseText));
      if (!remediationData.length) throw new Error('Gemini returned no usable weak-spot questions.');
      document.getElementById('weak-spots-mode').textContent = 'Gemini mode';
    } else {
      remediationData = createLocalRemediationSet(weakTopics);
      document.getElementById('weak-spots-mode').textContent = 'Local mode';
    }
    renderWeakSpotSet();
    document.getElementById('weak-spots-panel').hidden = false;
  } catch (error) {
    remediationData = createLocalRemediationSet(weakTopics);
    document.getElementById('weak-spots-mode').textContent = 'Local mode';
    renderWeakSpotSet();
    document.getElementById('weak-spots-panel').hidden = false;
    showUploadMessage(`Could not create the AI remediation set (${error.message}). Showing local practice instead.`, 'error');
  } finally {
    button.disabled = false;
    updateWeakSpotControls();
  }
}

function renderWeakSpotSet() {
  document.getElementById('weak-spots-content').innerHTML = remediationData.map((item, index) => `
    <article class="weak-item">
      <h4>${escapeHtml(item.topic)}</h4>
      <p>${escapeHtml(item.simple_explanation)}</p>
      <p><strong>${escapeHtml(item.follow_up_question)}</strong></p>
      <div class="quiz-options">
        ${item.options.map((option, optionIndex) => `<button class="quiz-option" id="weak-${index}-opt-${optionIndex}" onclick="selectRemediationOption(${index}, ${optionIndex})">${escapeHtml(option)}</button>`).join('')}
      </div>
      <p id="weak-${index}-exp" class="quiz-explanation" role="status" aria-live="polite" hidden></p>
      <button onclick="toggleCitation('weak-${index}-quote')" class="citation-button" style="margin-top:10px">Verify Source</button>
      <blockquote id="weak-${index}-quote" class="citation-quote" hidden>${escapeHtml(item.exact_quote || 'No exact supporting quote was returned for this question.')}</blockquote>
    </article>
  `).join('');
}

function selectRemediationOption(itemIndex, optionIndex) {
  const item = remediationData[itemIndex];
  if (!item) return;
  item.options.forEach((_, index) => {
    const button = document.getElementById(`weak-${itemIndex}-opt-${index}`);
    button.disabled = true;
    if (index === item.correct) button.classList.add('correct');
    else if (index === optionIndex) button.classList.add('incorrect');
  });
  showQuizFeedback(`weak-${itemIndex}-exp`, optionIndex === item.correct, item.options[item.correct], item.explanation);
}

function copyContent(elementId) {
  const text = document.getElementById(elementId).innerText;
  navigator.clipboard.writeText(text);
  alert("Copied to clipboard!");
}

function showUploadMessage(message, type = 'info') {
  const target = document.getElementById('upload-message');
  if (!target) return alert(message);
  target.textContent = message;
  target.className = `upload-message${type === 'error' ? ' error' : type === 'success' ? ' success' : ''}`;
}

function initializeSessions() {
  if (!sessions.length) createSession('First study session');
  if (!sessions.some(session => session.id === activeSessionId)) activeSessionId = sessions[0].id;
  renderSessions();
  loadSession(activeSessionId);
}

function createSession(title = 'New study session') {
  const session = { id: `session-${Date.now()}`, title, messages: [], createdAt: new Date().toISOString() };
  sessions.unshift(session);
  activeSessionId = session.id;
  persistSessions();
  renderSessions();
  renderChat();
  return session;
}

function persistSessions() {
  localStorage.setItem('easyPeasy_sessions', JSON.stringify(sessions));
  localStorage.setItem('easyPeasy_active_session', activeSessionId || '');
}

function renderSessions() {
  const list = document.getElementById('sessions-list');
  if (!list) return;
  list.innerHTML = sessions.map(session => `<button class="session-item ${session.id === activeSessionId ? 'active' : ''}" onclick="loadSession('${session.id}')"><span class="session-face">${session.messages.length ? '●' : '○'}</span><span class="session-title">${escapeHtml(session.title)}</span><span class="session-delete" onclick="deleteSession(event, '${session.id}')">×</span></button>`).join('');
}

function loadSession(id) {
  if (!sessions.some(session => session.id === id)) return;
  activeSessionId = id;
  persistSessions();
  renderSessions();
  renderChat();
}

function deleteSession(event, id) {
  event.stopPropagation();
  if (sessions.length === 1) return;
  sessions = sessions.filter(session => session.id !== id);
  if (activeSessionId === id) activeSessionId = sessions[0].id;
  persistSessions();
  renderSessions();
  renderChat();
}

function renderChat() {
  const chat = document.getElementById('chat-messages');
  if (!chat) return;
  const session = sessions.find(item => item.id === activeSessionId);
  chat.innerHTML = session && session.messages.length ? session.messages.map(message => `<div class="chat-message ${message.role}">${message.role === 'assistant' ? `<span class="penguin-cutout mood-${message.mood || 'happy'}" aria-label="${message.mood || 'happy'} penguin assistant"></span>` : '<span class="chat-user-avatar">You</span>'}<div><span class="mood">${message.role === 'assistant' ? message.mood || 'happy' : 'you'}</span><p>${escapeHtml(message.text)}</p></div></div>`).join('') : '<div class="chat-empty"><span class="penguin-cutout mood-happy" aria-label="Happy penguin assistant"></span><p>Ask me anything about your study material.</p></div>';
  chat.scrollTop = chat.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text) return;
  const session = sessions.find(item => item.id === activeSessionId);
  if (!session) return;
  if (session.title === 'First study session') session.title = text.slice(0, 28);
  session.messages.push({ role: 'user', text });
  input.value = '';
  persistSessions();
  renderSessions();
  renderChat();

  const apiKey = localStorage.getItem('gemini_api_key')?.trim();
  const fallback = text.includes('?')
    ? 'I’m thinking through that with you. Add your source material above and I’ll help turn it into something clear.'
    : 'Great start! Keep going — I’m here to help you learn step by step.';
  session.messages.push({ role: 'assistant', mood: 'thinking', text: 'Thinking…' });
  renderChat();

  if (apiKey) {
    try {
      const contents = session.messages.filter(message => message.text !== 'Thinking…').map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.text }]
      }));
      const { data: result } = await callGemini(apiKey, contents);
      const reply = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!reply) throw new Error('Empty chat response');
      session.messages[session.messages.length - 1] = { role: 'assistant', mood: 'happy', text: reply };
    } catch (error) {
      session.messages[session.messages.length - 1] = { role: 'assistant', mood: 'encouraging', text: fallback };
    }
  } else {
    session.messages[session.messages.length - 1] = { role: 'assistant', mood: 'encouraging', text: fallback };
  }
  persistSessions();
  renderChat();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}
