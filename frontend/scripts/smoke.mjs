/**
 * Renders the real app in jsdom and clicks through the demo flows end to end.
 * Run: node --import ./scripts/register.mjs scripts/smoke.mjs
 */
import { JSDOM, VirtualConsole } from 'jsdom';

/*
 * Two switches, set before any app module is imported (src/api/env.js reads
 * process.env when there is no bundler in the way):
 *
 *  VITE_POLL_MS=400    the app really does re-read the server on a timer, so a
 *                      change made by somebody else has to reach the screen with
 *                      nobody tapping anything.
 *  VITE_DEMO_HINTS=true  the register/verify screens are allowed to show the dev
 *                      code, which is the only way this file can confirm an email.
 */
process.env.VITE_POLL_MS = '400';
process.env.VITE_DEMO_HINTS = 'true';

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(`jsdom: ${e.message}`));
vc.on('error', (...a) => errors.push(`console.error: ${a.map(String).join(' ')}`));

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://studentsetu.local/',
  pretendToBeVisual: true,
  virtualConsole: vc,
});

global.window = dom.window;
global.document = dom.window.document;
// Node ≥21 defines a read-only `navigator` on globalThis, so assigning to it
// throws in a module; defineProperty works on every supported version.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = clearTimeout;
global.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, writable: true, configurable: true });

// sign the demo user in before the api module loads, and skip the intro slides
dom.window.localStorage.setItem('setu.token', 'u1');
dom.window.localStorage.setItem('setu.intro', '1');

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    fail += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${extra ? ` → ${String(extra).slice(0, 260)}` : ''}`);
  }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { default: App } = await import('../src/App.jsx');
const { default: api } = await import('../src/api');
const { AppProvider } = await import('../src/context/AppContext.jsx');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const step = 150;
const body = () => document.body.textContent.replace(/\s+/g, ' ');
const all = (sel) => [...document.querySelectorAll(sel)];
const byText = (label, sel = 'button, a') =>
  all(sel).find((el) => el.textContent.replace(/\s+/g, ' ').trim().includes(label));

/** Let React + the 300 ms mock latency catch up until a condition holds. */
async function waitFor(test, { timeout = 9000 } = {}) {
  const started = Date.now();
  for (;;) {
    await act(async () => {
      await wait(step);
    });
    let hit = false;
    try {
      hit = typeof test === 'function' ? !!test() : body().includes(test);
    } catch {
      hit = false;
    }
    if (hit) return true;
    if (Date.now() - started > timeout) return false;
  }
}

const awaitSwitch = async (i = 0) => {
  const found = await waitFor(() => all('button[role="switch"]').length > i);
  return found ? all('button[role="switch"]')[i] : null;
};

const clickEl = async (el) => {
  await act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(30);
  });
};

/** click + wait for the expected text; returns the found flag */
const tap = async (label, expect = null) => {
  const el = byText(label);
  if (!el) {
    ok(`tap “${label}”`, false, `buttons: ${all('button').map((b) => b.textContent.trim() || b.getAttribute('aria-label')).slice(0, 30).join(' | ')}`);
    return false;
  }
  await clickEl(el);
  return expect == null ? true : waitFor(expect);
};

const type = async (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  await act(async () => {
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await wait(20);
  });
};

/** React listens to `change` on a native select, not `input`. */
const selectOption = async (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set;
  setter.call(el, value);
  await act(async () => {
    el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await wait(20);
  });
};

const pressEnter = async (el) => {
  await act(async () => {
    el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(20);
  });
};

const root = createRoot(document.getElementById('root'));
await act(async () => {
  root.render(
    <AppProvider>
      <App />
    </AppProvider>
  );
});

/* ---------------------------------------------------------------- boot */
section('Boot · Home');
ok('session restore lands on Home', await waitFor('Hi, Gunmay'));
ok('college + branch line', body().includes('Graphic Era') && body().includes('3rd year'));
ok('Activity badge reads 2 new', await waitFor('2 new'));
ok('three feature cards', body().includes('Items') && body().includes('Skills') && body().includes('My Activity'));
ok('all three carousels present', body().includes('Swaps for you') && body().includes('Recently listed items') && body().includes('Top tutors'));
await waitFor('Open the circle');
ok('swaps-for-you teaser uses the seed circle', body().includes('Exchange circle') && body().includes('Open the circle'), body().slice(0, 300));
ok('bottom nav has 4 tabs', all('nav[aria-label="Main"] button').length === 4);
ok('status bar clock rendered', /\d{2}:\d{2}/.test(body()));
ok('no leaked objects or undefined', !body().includes('[object Object]') && !body().includes('undefined'));

/* -------------------------------------------------------- home search */
section('Home search');
await type(document.querySelector('#setu-search'), 'calclator');
ok('quick results panel appears', await waitFor('Results for'), body().slice(0, 300));
ok('typo query finds the item from Home', body().includes('Spare calculator'));
ok('cross-surface skill shortcut offered', await waitFor('in skill swaps'), body().slice(0, 400));
await type(document.querySelector('#setu-search'), '');
await waitFor(() => !body().includes('Results for'));

/* -------------------------------------------------------------- items */
section('Items · search, filters, did-you-mean');
await tap('Items');
ok('browse feed loads', await waitFor('listings'), body().slice(0, 240));
ok('free/barter/sell tags visible', body().includes('Barter') && body().includes('Free') && body().includes('Sell'));
await type(document.querySelector('#setu-search'), 'cacl');
ok('near miss shows “Did you mean”', await waitFor('Did you mean'), body().slice(0, 300));
await tap('Did you mean');
ok('tapping the suggestion re-runs the search', await waitFor('1 match'), body().slice(0, 300));
await type(document.querySelector('#setu-search'), '');
await waitFor('7 listings');
await tap('Barter');
ok('Barter chip filters the board', (await waitFor('Barter only')) && body().includes('DSA handwritten notes'), body().slice(0, 300));
await tap('All');
await waitFor('listings');
await tap('Spare calculator', 'Listed by');
ok('item detail opens with owner + mode block', body().includes('Join waitlist') && body().includes('in line'));
ok('privacy note before accepting', body().includes('Email hidden until'));

/* ------------------------------------------------------------ waitlist */
section('Free item · waitlist and hand-off');
await tap('Join waitlist', 'You are #2 in line');
await waitFor('Ahead of you');
ok('waitlist position is #2 (Asha ahead of me)', body().includes('You are #2 in line'));
ok('people ahead named', body().includes('Ahead of you: Asha'), body().slice(0, 300));
await tap('Items');
await waitFor('listings');
await tap('My items', 'Spare desk lamp');
ok('my listings show queue size', /\d waiting/.test(body()), body().slice(0, 260));
await tap('Give to next', 'First in line');
ok('confirm sheet names the next student', body().includes('Ishwar'));
await tap('Confirm hand-off', 'Handed over');
ok('receipt shows who received it + their email', body().includes('ishwar@geu.ac.in'));
await tap('Done', 'Taken');
ok('handed-off listing marked taken', body().includes('Taken'));

/* -------------------------------------------------------------- skills */
section('Skills · exchange circle');
await tap('Skills', 'What do you want to learn?');
await type(document.querySelector('#barter-skill'), 'python');
await tap('Find swaps', 'Exchange circle');
ok('no direct swap → circle card', body().includes('Exchange circle'));
ok('circle chain labelled “learns … from …”', body().includes('learns') && body().includes('from'));
ok('circle contains all three people', ['Gunmay', 'Ishwar', 'Gaurav'].every((n) => body().includes(n)));
ok('circle drawn as ring of avatars with arrows', all('svg path[marker-end]').length >= 3 && all('[aria-label], .card').length > 0, `arcs=${all('svg path[marker-end]').length}`);
await tap('Send request to everyone in the circle', 'Request sent to');
ok('toast confirms circle dispatch', body().includes('Request sent to 2 people'));
await waitFor('Sent to 2 people');
ok('button flips to the sent state', body().includes('Sent to 2 people'));

section('Skills · paid tutors and teaching');
await tap('Paid', 'Request session');
ok('tutor board loads with prices', body().includes('per hour') && body().includes('₹'));
ok('own tutor listing hidden from own search', !body().includes('C++ from basics'));
await type(document.querySelector('#paid-subject'), 'math');
await waitFor('2 tutors between');
ok('subject search narrows to maths tutors', body().includes('Maths for first year') && !body().includes('Python with projects'), body().slice(0, 320));
ok('did-you-mean style fuzz still matches the subject', body().includes('Maths quick revision'));
await type(document.querySelector('#paid-subject'), '');
await waitFor('4 tutors between');
await tap('Teach', 'Publish my tutoring');
await type(document.querySelector('#teach-subject'), 'Git for beginners');
await type(document.querySelector('#teach-desc'), 'Branching, rebasing and pull requests, one lab session.');
await type(document.querySelector('#teach-price'), '90');
await tap('Publish my tutoring', 'Git for beginners');
ok('new listing appears with a Live badge', body().includes('Git for beginners') && body().includes('Live'));
const pauseSwitch = await awaitSwitch(0);
await clickEl(pauseSwitch);
await waitFor(() => body().includes('Paused — hidden from search'));
ok('pause switch flips the listing to Paused', body().includes('Paused — hidden from search'));
const resumeSwitch = await awaitSwitch(0);
await clickEl(resumeSwitch);
await waitFor(() => body().includes('Accepting students'));
ok('resume brings the listing back', body().includes('Accepting students'));

/* ------------------------------------------------------------ activity */
section('Activity · privacy then contact');
await tap('Activity', 'Sent to you');
ok('received tab lists pending requests', body().includes('Sent to you'));
ok('pending cards expose Accept and Decline', !!byText('Accept') && !!byText('Decline'));
ok('email hidden until accepted', !body().includes('asha@geu.ac.in'));
await tap('Sent', 'Sent by you');
ok('sent tab shows my outgoing requests', body().includes('Sent by you') && (body().includes('Skill swap') || body().includes('Exchange circle')));
await tap('Received', 'Accept');
await tap('Accept', 'asha@geu.ac.in');
ok('accepting reveals the email', body().includes('asha@geu.ac.in'));
ok('copy + mail actions available', !!byText('Copy') && !!byText('Email'));
const mailtos = all('a[href^="mailto:"]').map((a) => a.getAttribute('href'));
ok(
  'email button is a mailto link with a prefilled subject',
  mailtos.some((h) => h.startsWith('mailto:asha@geu.ac.in?subject=')),
  `found=${all('a[href^="mailto:"]').map((a) => a.getAttribute('href').slice(0, 60)).join(' , ')}`
);
await waitFor(() => !body().includes('2 new'));
ok('badge dropped after handling a request', !body().includes('2 new'), body().slice(0, 200));

/* ------------------------------------- circles: consensus while you watch */
section('Activity · a circle closes while you are looking at it');
await tap('Circles', 'Waiting on');
ok('the circle I sent is listed as waiting', body().includes('Python') && body().includes('Waiting on 2'), body().slice(0, 300));
ok('nobody\u2019s email is on the card yet', !body().includes('ishwar@geu.ac.in'));

// both other members answer while the in-app broadcast is muted, so the only
// thing that can move this screen is the poll the app runs on its own
await act(async () => {
  // the in-app broadcast is muted so nothing the UI shows can be credited to a
  // push: the timer is the only thing that can move this screen
  await api.setNotifyMuted(true);
  for (const mail of ['ishwar@geu.ac.in', 'gaurav@geu.ac.in']) {
    await api.login({ email: mail, password: '123456' });
    const theirs = (await api.getMyCircles()).circles.find((c) => c.canAnswer);
    if (theirs) await api.answerCircle(theirs.id, true);
  }
  await api.login({ email: 'gunmay@geu.ac.in', password: '123456' }); // back to whoever the UI is signed in as
  await api.setNotifyMuted(false);
});

const settled = () =>
  body().includes('Circle agreed') && body().includes('ishwar@geu.ac.in') && body().includes('gaurav@geu.ac.in');
ok('the timer brings both answers in with no tap', await waitFor(settled, { timeout: 9000 }), body().slice(0, 300));
ok('consensus is stated as such', body().includes('agreed by everyone'), body().slice(0, 300));
ok('my own address is not offered back to me', !body().includes('gunmay@geu.ac.in'));

/* --------------------------------------------- activity: rating an exchange */
section('Activity · one rating per accepted exchange');
await tap('Received', null);
const rateBtn = byText('Rate this exchange') || byText('Rate');
ok('the row you both accepted offers a rating', !!rateBtn, body().slice(0, 240));
await clickEl(rateBtn);
await waitFor('Pick a number of stars');
ok('the sheet asks for stars before it lets you send', !!byText('Pick a number of stars'));
ok('five choices, no half stars', all('button[role="radio"]').length === 5, all('button[role="radio"]').length);
const fourStars = all('button[role="radio"]').find((b) => b.getAttribute('aria-label') === '4 stars');
await clickEl(fourStars);
await waitFor('Send 4 stars');
await tap('Send 4 stars', 'Rated \u2014 thank you');
ok('the save is acknowledged', body().includes('Rated \u2014 thank you'), body().slice(0, 240));
await waitFor(() => !byText('Send 4 stars'));
await waitFor(() => !byText('Rate this exchange') && !byText('Rate', 'button'));
ok('the sheet closed and the row stops asking', !byText('Rate this exchange') && !byText('Rate', 'button'), body().slice(0, 300));

/* ------------------------------------------------------------- profile */
section('Profile · skills, theme, demo reset');
await tap('Items');
await clickEl(document.querySelector('button[aria-label="Open your profile"]'));
await waitFor('GEU verified');
ok('profile shows identity + verification', body().includes('gunmay@geu.ac.in') && body().includes('GEU verified'));
ok('stats rendered', body().includes('Items listed') && body().includes('Swaps done') && body().includes('Requests'));
await clickEl(await awaitSwitch(0));
await waitFor(() => document.documentElement.classList.contains('dark'));
ok('dark mode toggle applies the class', document.documentElement.classList.contains('dark'));
await clickEl(await awaitSwitch(0));
await waitFor(() => !document.documentElement.classList.contains('dark'));
ok('dark mode can be turned back off', !document.documentElement.classList.contains('dark'));
await waitFor('When I am free');
ok('the profile offers the availability editor', body().includes('When I am free'));
await clickEl(document.querySelector('button[aria-label="Edit when I am free"]'));
await waitFor('When are you free?');
ok('the sheet starts from what the server has', String(document.querySelector('#free-lines')?.value).includes('Mon 14:00-18:00'), document.querySelector('#free-lines')?.value);
await type(document.querySelector('#free-lines'), 'Mon 14:00-17:00\nwhenever');
await tap('Save windows', 'Use a line like');
ok('a line that is not a window is refused before anything is sent', body().includes('Use a line like'), body().slice(0, 260));
await type(document.querySelector('#free-lines'), 'Mon 14:00-17:00\nTue 09:00-11:00');
await tap('Save windows', 'When I am free');
ok('a valid pair saves and shows on the profile', await waitFor(() => body().includes('Mon 14:00-17:00')), body().slice(0, 260));

await tap('Edit skills', 'Skills I want to learn');
ok('skills sheet opens with both lists', !!document.querySelector('#edit-teach') && !!document.querySelector('#edit-learn'));
await type(document.querySelector('#edit-teach'), 'Git');
await pressEnter(document.querySelector('#edit-teach'));
ok('chip added to the sheet', !!byText('Git', 'span'));
await waitFor('Your skills');
await tap('Save skills');
await waitFor(() => !body().includes('Skills I want to learn'));
ok('skill saved and shown on profile', body().includes('Git'), body().slice(0, 260));
await tap('Reset', 'Load demo data?');
await tap('Load demo data', 'Hi, Gunmay');
ok('demo reset returns to Home', body().includes('Hi, Gunmay'));
await waitFor('2 new');
ok('seed badge restored after reset', body().includes('2 new'));
await tap('Items');
await waitFor('listings');
await tap('My items');
ok('handed-off listing is live again after the reset', await waitFor('Available'), body().slice(0, 300));

/* ------------------------------------------------------ auth, end to end */
section('Auth · sign out, register, confirm the code, back in');
await clickEl(document.querySelector('button[aria-label="Open your profile"]'));
await waitFor('Log out');
await tap('Log out', 'Welcome back.');
ok('signing out drops the token', !dom.window.localStorage.getItem('setu.token'), dom.window.localStorage.getItem('setu.token'));
ok('and the app is at the front door', body().includes('Welcome back.'));
await tap('Create an account', 'Join StudentSetu');
await type(document.querySelector('#reg-name'), 'Test Taster');
await type(document.querySelector('#reg-email'), 'test.taster@geu.ac.in');
await selectOption(document.querySelector('#reg-branch'), 'CSE');
await selectOption(document.querySelector('#reg-year'), '2');
await type(document.querySelector('#reg-password'), 'secret123');
await type(document.querySelector('#reg-teaches'), 'Sketching');
await pressEnter(document.querySelector('#reg-teaches'));
ok('the chip lands in the form before submitting', !!byText('Sketching', 'span'), body().slice(0, 200));
await tap('Join StudentSetu', 'Confirm your email');
ok('register hands over to the code screen, not the app', body().includes('We sent a code to test.taster@geu.ac.in'), body().slice(0, 300));
ok('the dev code is only on screen because hints are on', document.querySelector('#verify-otp')?.value === '123456', document.querySelector('#verify-otp')?.value);
await tap('Confirm and continue', 'Hi, Test');
ok('the confirmed account is signed in', body().includes('Hi, Test'), body().slice(0, 300));
await clickEl(document.querySelector('button[aria-label="Open your profile"]'));
await waitFor('When I am free');
ok('a brand new profile is already verified', body().includes('GEU verified'), body().slice(0, 300));
ok('and it carries no history yet', body().includes('Items listed') && !body().includes('handed over'));
await tap('Log out', 'Welcome back.');
await tap('Try demo as Gunmay', 'Hi, Gunmay');
ok('back to the demo account, no code needed', body().includes('Hi, Gunmay'), body().slice(0, 240));
ok('the token in storage is the demo user', dom.window.localStorage.getItem('setu.token') === 'u1', dom.window.localStorage.getItem('setu.token'));

/* ------------------------------------------------------- error states */
section('Error states when the API fails');
await clickEl(document.querySelector('button[aria-label="Open your profile"]'));
await waitFor('Demo controls');
await clickEl(await awaitSwitch(2));
ok('failure switch flips', body().includes('Force API errors'));
await tap('Items', 'Something went wrong');
ok('list renders its error state with a retry', body().includes('Something went wrong') && !!byText('Try again'));
await clickEl(document.querySelector('button[aria-label="Open your profile"]'));
await waitFor('Demo controls');
await clickEl(await awaitSwitch(2));
await tap('Items');
await waitFor('listings');
ok('recovers after the failure mode is off', body().includes('listings'), body().slice(0, 240));

/* ------------------------------------------------------------- labels */
section('Accessibility spot checks');
await tap('Skills');
await tap('Paid');
await tap('Teach');
await waitFor('#teach-subject', 3000).catch(() => {});
await waitFor(() => !!document.querySelector('#teach-subject'));
const unlabelled = all('input, textarea, select').filter(
  (el) => !el.getAttribute('aria-label') && !(el.id && document.querySelector(`label[for="${el.id}"]`))
);
ok(
  'every input, textarea and select has a label',
  unlabelled.length === 0 && all('input, textarea, select').length > 0,
  `unlabelled=${unlabelled.map((e) => e.id || e.tagName).join(',')} of ${all('input, textarea, select').length}`
);
ok('nav buttons carry aria-labels', all('nav[aria-label="Main"] button').every((b) => b.getAttribute('aria-label')));
ok('switches expose role=switch and aria-checked', all('button[role="switch"]').every((b) => b.hasAttribute('aria-checked')));
ok('no console errors during the run', errors.length === 0, errors.slice(0, 2).join(' || '));

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`);
if (errors.length) console.log('captured console errors:\n', errors.slice(0, 5).join('\n'));
process.exit(fail ? 1 : 0);
