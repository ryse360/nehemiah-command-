const states = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

const content = {
  resting: { prompt: 'What matters most now?' },
  listening: { prompt: 'I am listening.' },
  'focus-surfaced': { prompt: 'This matters most now.' },
  'decision-required': { prompt: 'This requires your decision.' },
  'action-underway': { prompt: 'The decision is in action.' },
  'proof-created': { prompt: 'Proof change is possible.' },
};

const body = document.body;
const prompt = document.querySelector('#primaryPrompt');
const buttonsHost = document.querySelector('#stateButtons');
const whyButton = document.querySelector('#whyButton');
const whyCopy = document.querySelector('#whyCopy');
const commandForm = document.querySelector('#commandForm');
const commandInput = document.querySelector('#commandInput');
const voiceButton = document.querySelector('#voiceButton');
const openDecision = document.querySelector('#openDecision');

function setState(state) {
  if (!states.includes(state)) throw new Error(`Unknown state: ${state}`);
  body.dataset.state = state;
  prompt.textContent = content[state].prompt;
  document.querySelectorAll('.state-button').forEach((button) => {
    button.classList.toggle('is-current', button.dataset.state === state);
  });
}

states.forEach((state) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'state-button';
  button.dataset.state = state;
  button.textContent = state.replaceAll('-', ' ');
  button.addEventListener('click', () => setState(state));
  buttonsHost.append(button);
});

whyButton.addEventListener('click', () => {
  const isHidden = whyCopy.hidden;
  whyCopy.hidden = !isHidden;
  whyButton.textContent = isHidden ? 'Hide reason ↑' : 'Why this comes first ↓';
});

voiceButton.addEventListener('click', () => setState('listening'));
openDecision.addEventListener('click', () => setState('action-underway'));
commandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!commandInput.value.trim()) return;
  setState('listening');
  window.setTimeout(() => setState('focus-surfaced'), 700);
  window.setTimeout(() => setState('decision-required'), 1500);
  commandInput.value = '';
});

setState('decision-required');
