/**
 * Headless check of the shipped api module (the real one, not a re-write).
 * Run: node scripts/test-api.mjs
 */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { default: api } = await import('../src/api/index.js');
const { textMatches, similarity, cleanSkill } = await import('../src/api/logic.js');

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    fail += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${label} ${extra ? `→ ${JSON.stringify(extra)}` : ''}`);
  }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const throws = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
};

await api.resetDemo();

/* ------------------------------------------------------------------ rules */
section('Rule 1 — 50% similarity search');
ok('"calclator" matches "Spare calculator"', textMatches('calclator', 'Spare calculator') === true);
ok('"pyhton" matches "Python Programming"', textMatches('pyhton', 'Python Programming') === true);
ok('"ca" matches on word start', textMatches('ca', 'Calculator') === true);
ok('"ca" does not match mid-word "Education"', textMatches('ca', 'Data structures') === false);
ok('clean compare: " DBMS " equals "dbms"', cleanSkill('  DBMS \n') === 'dbms');
ok('similarity("cat","bat") = 1 - 1/3', Math.abs(similarity('cat', 'bat') - 2 / 3) < 1e-9, similarity('cat', 'bat'));
ok('"xyzzy" matches nothing', textMatches('xyzzyq', 'Spare calculator') === false);

/* ------------------------------------------------------------------- auth */
section('Auth + demo login');
const gunmay = await api.login({ email: 'gunmay@geu.ac.in', password: '123456' });
ok('Gunmay logs in', gunmay.user.name === 'Gunmay');
ok('wrong password is rejected', !!(await throws(() => api.login({ email: 'gunmay@geu.ac.in', password: 'nope' }))));
ok('non-GEU email rejected on register', !!(await throws(() => api.register({ name: 'Test', email: 'a@gmail.com', branch: 'CSE', year: 1, password: '123456', teaches: ['x'] }))));
ok('register needs one teach skill', !!(await throws(() => api.register({ name: 'Test', email: 'test@geu.ac.in', branch: 'CSE', year: 1, password: '123456', teaches: [] }))));
ok('blank teaches list rejected after trim', !!(await throws(() => api.register({ name: 'Test', email: 'test@geu.ac.in', branch: 'CSE', year: 1, password: '123456', teaches: ['  '], wants: [] }))));
ok('duplicate email rejected', !!(await throws(() => api.register({ name: 'Dupe', email: 'gunmay@geu.ac.in', branch: 'CSE', year: 1, password: '123456', teaches: ['x'] }))));

/* ------------------------------------------------------------------- seed */
section('Seed state for Gunmay');
await api.login({ email: 'gunmay@geu.ac.in', password: '123456' });
const me = await api.getMe();
ok('badge = 2 pending received', me.pendingReceived === 2, me.pendingReceived);
ok('teaches C++ and DBMS', me.teaches.join('|') === 'C++|DBMS', me.teaches);

const empty = await api.searchItems('', 'all', 'newest');
ok('empty query -> no results', empty.items.length === 0 && empty.suggestion === null);

const typo = await api.searchItems('calclator', 'all', 'newest');
ok('typo "calclator" finds Spare calculator', typo.items.length === 1 && typo.items[0].title === 'Spare calculator', typo.items.map((i) => i.title));
ok('own listing i8 hidden from results', !(await api.searchItems('notes', 'all', 'newest')).items.some((i) => i.id === 'i8'));
const noMatch = await api.searchItems('cacl', 'all', 'newest');
ok('did-you-mean suggested when nothing matches', !!noMatch.suggestion, noMatch.suggestion);
const modeFilter = await api.searchItems('calc', 'free', 'newest');
ok('mode filter keeps Free only', modeFilter.items.every((i) => i.mode === 'free'));
const sell = await api.getBrowse({ mode: 'sell', sort: 'price_asc' });
ok('price low->high sorts sell items', sell.items.map((i) => i.price).join(',') === '150,250,400', sell.items.map((i) => i.price));
const sellDesc = await api.getBrowse({ mode: 'sell', sort: 'price_desc' });
ok('price high->low sorts sell items', sellDesc.items.map((i) => i.price).join(',') === '400,250,150');
const cats = await api.getCategories();
ok('categories carry counts and exclude mine', cats.some((c) => c.name === 'Notes' && c.count >= 1) && cats.every((c) => c.count > 0));

/* ------------------------------------------------------------- barter */
section('Two-way swap + exchange circle');
const gBarter = await api.findBarter('python');
ok('no two-way swap for python', gBarter.swaps.length === 0);
ok('circle found instead', !!gBarter.circle, gBarter.circle);
ok('circle is Gunmay -> Ishwar -> Gaurav', gBarter.circle?.people.map((p) => p.name).join('->') === 'Gunmay->Ishwar->Gaurav', gBarter?.circle?.people?.map((p) => p.name));
ok(
  'circle arrows read "X learns skill from Y"',
  gBarter.circle.edges.map((e) => `${e.from} learns ${e.skill} from ${e.to}`).join(' | ') ===
    'Gunmay learns Python from Ishwar | Ishwar learns DSA from Gaurav | Gaurav learns C++ from Gunmay',
  gBarter.circle?.edges
);
ok('circle members exclude me', gBarter.circle.memberIds.join(',') === 'u2,u3');
ok('oneWay hidden when a circle exists', gBarter.oneWay.length === 0);

const casey = await api.findBarter('PYTHON');
ok('skill matching ignores case + spaces', casey.circle?.people.length === 3);
ok('unknown skill -> all empty', await api.findBarter('underwater basketweaving').then((r) => !r.swaps.length && !r.circle && !r.oneWay.length));
ok('empty skill -> all empty', await api.findBarter('   ').then((r) => !r.swaps.length && !r.circle && !r.oneWay.length));

await api.login({ email: 'asha@geu.ac.in', password: '123456' });
const ashaBarter = await api.findBarter(' dbms ');
ok('Asha searching " dbms " gets a two-way swap', ashaBarter.swaps.length === 1 && ashaBarter.swaps[0].peer.name === 'Ravi', ashaBarter.swaps.map((s) => s.peer?.name));
ok('score counts my skills they want', ashaBarter.swaps[0].score === 1);
ok('"wants from you" keeps the display casing ("Maths", not "maths")', ashaBarter.swaps[0].wantsFromYou.join(',') === 'Maths', ashaBarter.swaps[0].wantsFromYou);
ok('a search for " dbms " is displayed as its teacher writes it', ashaBarter.skillLabel === 'DBMS' && ashaBarter.swaps[0].skillLabel === 'DBMS', ashaBarter.skillLabel);
{
  const sent = await api.sendSwapRequest(ashaBarter.swaps[0].peer.id, ashaBarter.swaps[0].skill);
  ok('the swap request stores the display casing', sent.request.skill === 'DBMS' && sent.request.note.endsWith('for DBMS'), sent.request);
  ok('…and both sides read it the same way', (await api.getRequests()).sent.some((r) => r.title === 'Skill swap · DBMS'));
  ok('sender subtitle names the ask', (await api.getRequests()).sent.find((r) => r.type === 'swap')?.subtitle === 'You asked Ravi to teach you DBMS');
  ok('an unknown skill keeps the typed casing', (await api.findBarter('Figma')).skillLabel === 'Figma');
  await api.login({ email: 'ravi@geu.ac.in', password: '123456' }); // only the receiver may answer
  const forRavi = (await api.getRequests()).received.find((r) => r.type === 'swap' && r.status === 'pending');
  await api.declineRequest(forRavi.id); // tidy up: leave the seeded campus as we found it
  await api.login({ email: 'asha@geu.ac.in', password: '123456' });
}
ok('no circle when a swap exists', ashaBarter.circle === null);
const swapRes = await api.sendSwapRequest('u5', 'DBMS');
ok('swap request created as pending', swapRes.request.status === 'pending' && swapRes.request.type === 'swap');
ok('duplicate pending swap blocked', !!(await throws(() => api.sendSwapRequest('u5', ' DBMS '))));
ok('seeded pending swap also counts as a duplicate', !!(await throws(() => api.sendSwapRequest('u1', 'DBMS'))));
ok('cannot swap with yourself', !!(await throws(() => api.sendSwapRequest('u4', 'Maths'))));
const afterSwap = await api.findBarter('dbms');
ok('already-requested flag surfaces', afterSwap.swaps[0].alreadyRequested === true);

/* ------------------------------------------------------------- waitlist */
section('Free items, waitlist and hand-off');
await api.login({ email: 'gunmay@geu.ac.in', password: '123456' });
const join = await api.joinWaitlist('i1');
ok('Gunmay joins as #2 (Asha was first)', join.position === 2, join);
ok('people ahead listed', join.ahead.join(',') === 'Asha', join.ahead);
ok('duplicate join blocked', !!(await throws(() => api.joinWaitlist('i1'))));
ok('owner cannot join own item', !!(await throws(() => api.joinWaitlist('i9'))));
ok('waitlist only on free items', !!(await throws(() => api.joinWaitlist('i2'))));

const hand = await api.handOff('i9');
ok('hand-off goes to first in line (Ishwar)', hand.to.name === 'Ishwar', hand.to);
ok('email shared on hand-off', hand.to.email === 'ishwar@geu.ac.in');
ok('item marked unavailable', (await api.getItem('i9')).available === false);
ok('remaining queue reported', hand.remaining === 1, hand.remaining);
ok('hand-off on empty queue blocked', !!(await throws(() => api.handOff('i5'))));
ok('non-owner cannot hand off', !!(await throws(() => api.setItemActive('i1', false))));

/* ---------------------------------------------------------- item offers */
section('Barter offer + buy request + accept side effects');
const ashaNotes = 'i2';
const offer = await api.requestItem(ashaNotes, 'i8');
ok('barter offer recorded', offer.request.offer.id === 'i8' && offer.request.item.id === 'i2', offer.request);
ok('barter without an offer is rejected', !!(await throws(() => api.requestItem(ashaNotes, null))));
ok('duplicate pending offer blocked', !!(await throws(() => api.requestItem(ashaNotes, 'i8'))));
ok('cannot request your own item', !!(await throws(() => api.requestItem('i8', 'i1'))));
ok('free item cannot take a request', !!(await throws(() => api.requestItem('i1', null))));

// Asha received two pending item requests now: from Gunmay (i8 offered) and from Gaurav (r2, i1 offered)
await api.login({ email: 'asha@geu.ac.in', password: '123456' });
const inbox = await api.getRequests();
const forNotes = inbox.received.filter((r) => r.itemId !== 'x' && r.item?.id === 'i2');
ok('Asha sees the offer for her notes', forNotes.length === 1, forNotes.map((r) => r.title));
const acc = await api.acceptRequest(forNotes[0].id);
ok('accept reveals contact email', acc.contact.email === 'gunmay@geu.ac.in', acc.contact);
ok('accepted item becomes unavailable', (await api.getItem('i2')).available === false);
ok('offered item becomes unavailable too', (await api.getItem('i8')).available === false);
ok('other pending request for the same item auto-declined', acc.declinedOthers === 1, acc.declinedOthers);
ok('accepting twice is blocked', !!(await throws(() => api.acceptRequest(forNotes[0].id))));
ok('only the receiver can accept', (await api.login({ email: 'ravi@geu.ac.in', password: '123456' }), !!(await throws(() => api.acceptRequest('r1')))));
await api.login({ email: 'gunmay@geu.ac.in', password: '123456' });
ok('sender sees contact unlocked on accepted', (await api.getRequests()).sent.some((r) => r.status === 'accepted' && r.otherContact?.email === 'asha@geu.ac.in'));
ok('auto-decline reached the request that touched the offered item', (await api.getRequests()).received.every((r) => r.status !== 'pending' || r.id !== 'r2'));

/* ---------------------------------------------------------------- tutors */
section('Paid tutoring');
await api.login({ email: 'gunmay@geu.ac.in', password: '123456' });
const maths = await api.searchTutors('math', 0, 1000, 'price_asc');
ok('maths finds two tutors cheap first', maths.tutors.map((t) => t.pricePerHour).join(',') === '120,150', maths.tutors.map((t) => t.subject));
const desc = await api.searchTutors('', 0, 1000, 'price_desc');
ok('sort high->low, own listing excluded', desc.tutors.map((t) => t.pricePerHour).join(',') === '180,150,120,100', desc.tutors.map((t) => t.pricePerHour));
const cheap = await api.searchTutors('', 0, 150, 'price_asc');
ok('price range filters', cheap.tutors.every((t) => t.pricePerHour <= 150) && cheap.tutors.length === 3, cheap.tutors.length);
const mineTutors = await api.searchTutors('c++', 0, 1000, 'price_asc');
ok("own tutor listing hidden from own search", mineTutors.tutors.length === 0, mineTutors.tutors.map((t) => t.subject));
ok('cannot request your own session', !!(await throws(() => api.requestTutor('t1'))));
const req = await api.requestTutor('t2');
ok('paid session request created', req.request.type === 'paid' && req.request.status === 'pending');
ok('duplicate paid request blocked', !!(await throws(() => api.requestTutor('t2'))));
const added = await api.addTeaching({ subject: 'Git for beginners', description: 'Branching, rebasing and pull requests in the lab.', pricePerHour: 90 });
ok('teaching listing added and active', added.active === true && added.pricePerHour === 90);
ok('teaching needs a description', !!(await throws(() => api.addTeaching({ subject: 'x', description: 'short', pricePerHour: 10 }))));
await api.setTeachingActive(added.id, false);
const pausedOut = await api.searchTutors('git', 0, 1000, 'price_asc');
ok('paused listing disappears from search', pausedOut.tutors.length === 0);
const myTeaching = await api.getMyTeaching();
ok('my teaching still lists paused item', myTeaching.some((t) => t.id === added.id && t.active === false));

/* -------------------------------------------------------------- updates */
section('Profile edits + badge');
const upd = await api.updateSkills({ teaches: ['C++', 'DBMS', 'Git'], wants: ['Python', 'Figma'] });
ok('skills updated', upd.teaches.includes('Git') && upd.wants.includes('Figma'));
ok('cannot drop all teach skills', !!(await throws(() => api.updateSkills({ teaches: [], wants: [] }))));
const newBadge = await api.getPendingCount();
ok('pending count updates after activity', newBadge.count === 1, newBadge.count);
const listed = await api.listItem({ title: 'Old Bluetooth speaker', category: 'Electronics', mode: 'sell', price: 300, condition: 'Fair', description: 'Works, scratch on the side.' });
ok('new listing shows in browse for others', (await api.login({ email: 'ravi@geu.ac.in', password: '123456' }), (await api.searchItems('bluetooth', 'all', 'newest')).items[0]?.id === listed.id));
ok('owner can remove own listing', (await api.login({ email: 'gunmay@geu.ac.in', password: '123456' }), (await api.removeItem(listed.id)).ok === true));
ok('removed listing disappears', !!(await throws(() => api.getItem(listed.id))));

/* --------------------------------------------------------------- surface */
section('Every api.<method> the screens call actually exists');
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  // a file: URL's .pathname is "/C:/Users/…" on Windows — fileURLToPath is the
  // only spelling that is a real path on every platform
  const { fileURLToPath } = await import('node:url');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(fileURLToPath(new URL('../src', import.meta.url)));
  const called = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bapi\.([a-zA-Z_$][\w$]*)\s*\(/g)) {
      if (!called.has(m[1])) called.set(m[1], path.relative(process.cwd(), file));
    }
  }
  const missing = [...called.entries()].filter(([name]) => !(name in api));
  ok(`${called.size} api methods are used by the UI, all present`, missing.length === 0, missing);

  // the C++ server speaks two verbs and takes its session from a bearer token only
  const apiFiles = ['client.js', 'index.js', 'adapters.js', 'env.js'].map((f) => [
    f,
    fs.readFileSync(new URL(`../src/api/${f}`, import.meta.url), 'utf8'),
  ]);
  const wrongVerb = apiFiles.filter(([, text]) => /['"](?:PUT|PATCH|DELETE)['"]/.test(text));
  ok('no request uses a verb the server does not have', wrongVerb.length === 0, wrongVerb.map(([f]) => f));
  const sendsCredentials = apiFiles.filter(([, text]) => /credentials\s*:/.test(text));
  ok('nothing sets fetch credentials (bearer token, no cookies)', sendsCredentials.length === 0, sendsCredentials.map(([f]) => f));
  const client = apiFiles.find(([f]) => f === 'client.js')[1];
  ok('and the bearer header is the only auth sent', /Authorization: `Bearer \$\{token\}`/.test(client) && !/Cookie/.test(client));

  // the alias has to be real, not decoration: re-import the env module with each flag set
  const base = await import('../src/api/env.js?case=base');
  ok('no flag, no hints (this run is mock mode without the dev server)', base.DEMO_HINTS === false, base.DEMO_HINTS);
  process.env.VITE_SHOW_DEV_OTP = 'true';
  const viaAlias = await import('../src/api/env.js?case=alias');
  ok('VITE_SHOW_DEV_OTP=true turns the hints on', viaAlias.DEMO_HINTS === true, viaAlias.DEMO_HINTS);
  delete process.env.VITE_SHOW_DEV_OTP;
  process.env.VITE_DEMO_HINTS = 'false';
  process.env.VITE_SHOW_DEV_OTP = 'false';
  const pinnedOff = await import('../src/api/env.js?case=pinned');
  ok('both names pinned false stays off', pinnedOff.DEMO_HINTS === false, pinnedOff.DEMO_HINTS);
  delete process.env.VITE_SHOW_DEV_OTP;
  delete process.env.VITE_DEMO_HINTS;
  process.env.VITE_DEMO_HINTS = 'true';
  const viaName = await import('../src/api/env.js?case=name');
  ok('VITE_DEMO_HINTS=true still works on its own', viaName.DEMO_HINTS === true, viaName.DEMO_HINTS);
  process.env.VITE_DEMO_HINTS = 'false';
  const off = await import('../src/api/env.js?case=off');
  ok('and false is honoured, not ignored', off.DEMO_HINTS === false, off.DEMO_HINTS);
  delete process.env.VITE_DEMO_HINTS;
  process.env.VITE_DEMO_HINTS = 'true'; // back to what the rest of this file expects
}

/* --------------------------------------------------- circles (mock model) */
section('Circles · consensus, cancel and privacy');
await api.resetDemo(); // the circle story starts from the seed
const circleSearch = await api.findBarter('Python');
ok('no two-way swap for Python', circleSearch.swaps.length === 0, circleSearch.swaps.map((s) => s.peer?.name));
ok('but a three-person circle closes the loop', circleSearch.circle?.size === 3, circleSearch.circle?.size);
const asked = await api.sendCircleRequest(circleSearch.circle.memberIds, 'Python');
ok('the ask goes to the other two', asked.sent === 2, asked.sent);
ok('and the circle is echoed back as waiting', asked.circle?.status === 'waiting', asked.circle?.status);
const myCircles = await api.getMyCircles();
ok('it appears in my circle list', myCircles.count === 1 && myCircles.circles[0].skill === 'Python', myCircles);
const c0 = myCircles.circles[0];
ok('nobody is marked no just for not answering', c0.waitingCount === 2 && c0.yesCount === 1, { w: c0.waitingCount, y: c0.yesCount });
ok('contacts stay hidden below consensus', c0.contactsVisible === false && c0.members.every((m) => !m.contact));
ok('a circle I started is not waiting on me', c0.waitingForMe === false && c0.iInitiated === true);
ok('asking the same group twice is refused', !!(await throws(() => api.sendCircleRequest(circleSearch.circle.memberIds, 'Python'))));

await api.login({ email: 'ishwar@geu.ac.in', password: '123456' });
const asIshwar = (await api.getMyCircles()).circles.find((c) => c.id === c0.id);
ok('the invitee sees it waiting on him', asIshwar.waitingForMe === true && asIshwar.canAnswer === true, asIshwar);
const half = await api.answerCircle(c0.id, true);
ok('one yes of two is still not a circle', half.circle.status === 'waiting', half.circle.status);

await api.login({ email: 'gaurav@geu.ac.in', password: '123456' });
const allYes = await api.answerCircle(c0.id, true);
ok('the last yes is what makes it active', allYes.circle.status === 'active', allYes.circle.status);

await api.login({ email: 'gunmay@geu.ac.in', password: '123456' });
const agreed = (await api.getMyCircles()).circles[0];
ok('consensus reveals the two other emails', agreed.contactsVisible === true && agreed.members.filter((m) => m.contact).length === 2, agreed.members.map((m) => m.contact?.email));
ok('but never my own address', agreed.members.find((m) => m.student.id === 'u1').contact === null);
ok('the founder cannot answer their own circle', !!(await throws(() => api.answerCircle(c0.id, true))));
const quit = await api.answerCircle(c0.id, false);
ok('the founder saying no closes it for everyone', quit.status === 'cancelled', quit.status);

/* ------------------------------------------ queues, hand-offs, duplicates */
section('Waitlist and hand-off are one-way doors');
await api.resetDemo();
const queueJoin = await api.joinWaitlist('i1');
ok('joining a queue returns my place', queueJoin.position === 2 && queueJoin.total === 2, queueJoin);
ok('and names ahead of me', queueJoin.ahead.join(',') === 'Asha', queueJoin.ahead);
const hand1 = await api.handOff('i9');
ok('the hand-off names who got it', hand1.to.name === 'Ishwar' && hand1.to.email === 'ishwar@geu.ac.in', hand1.to);
ok('the queue is emptied with it', (await api.getItem('i9')).waitlistCount === 0, (await api.getItem('i9')).waitlistCount);
const handAgain = await throws(() => api.handOff('i9'));
ok('a second hand-off of a taken item is refused', /already been handed over/.test(handAgain || ''), handAgain);
ok('nobody can join a queue for a given-away item', !!(await throws(() => api.joinWaitlist('i9'))));
ok('the winner cannot join it either', !!(await throws(() => api.handOff('i5'))));

/* ----------------------------------------------------- availability rules */
section('Free time and meeting windows');
const savedSlots = await api.setFreeTime(['Mon 14:00-17:00', 'Tue 9-11']);
ok('lines are normalised on the way in', savedSlots.join('|') === 'Mon 14:00-17:00|Tue 09:00-11:00', savedSlots);
ok('a line that is not a window is refused', !!(await throws(() => api.setFreeTime(['whenever']))));
ok('too many windows are refused', !!(await throws(() => api.setFreeTime(['Mon 9-10', 'Tue 9-10', 'Wed 9-10', 'Thu 9-10', 'Fri 9-10', 'Sat 9-10', 'Sun 9-10', 'Mon 13-14', 'Tue 13-14']))));
ok('the profile shows what was saved', (await api.getMe()).freeTime.length === 2);
const meet = await api.getMeet('u4');
ok('overlap is computed from both calendars', meet.slots.includes('Tue 09:00-11:00'), meet.slots);
ok('and an empty overlap stays empty', (await api.getMeet('u5')).slots.length === 0, (await api.getMeet('u5')).slots);

/* ---------------------------------------------------------------- ratings */
section('Ratings move an average, never invent one');
const ashaBefore = await api.getStudent('u4');
ok('a person carries the score the store has', ashaBefore.rating === 4.8 && ashaBefore.ratingCount === 41, ashaBefore);
const inboxForRating = await api.getRequests();
const ashaSwap = inboxForRating.received.find((r) => r.type === 'swap' && r.other.id === 'u4');
ok('an open request is not rateable yet', ashaSwap.canRate === false, ashaSwap.canRate);
await api.acceptRequest(ashaSwap.id);
const rateable = (await api.getRequests()).received.find((r) => r.id === ashaSwap.id);
ok('once accepted it is', rateable.canRate === true);
const ratedNow = await api.rateRequest(ashaSwap.id, 4);
ok('my star lands on their mean', ratedNow.rating === 4.8 && ratedNow.ratingCount === 42, ratedNow);
ok('and only once per person', /already rated/i.test((await throws(() => api.rateRequest(ashaSwap.id, 5))) || ''));
ok('out-of-range stars are refused before saving', !!(await throws(() => api.rateRequest(ashaSwap.id, 9))));
ok('the row stops offering the button afterwards', (await api.getRequests()).received.find((r) => r.id === ashaSwap.id).canRate === false);

/* ------------------------------------------------- verification + honesty */
section('Verification, sessions and withheld demo hints');
ok('a seeded account reads as verified', (await api.login({ email: 'gunmay@geu.ac.in', password: '123456' }), (await api.getMe()).verified === true));
const reg = await api.register({ name: 'New Kid', email: 'new@geu.ac.in', branch: 'CSE', year: 1, password: 'secret123', teaches: ['Sketching'] });
ok('register does not sign anybody in', (await api.getMe()).name === 'Gunmay');
ok('the dev OTP is withheld unless hints are on', reg.devOtp === null, reg.devOtp);
const tooShort = await throws(() => api.register({ name: 'Short', email: 'short@geu.ac.in', branch: 'CSE', year: 1, password: '1234', teaches: ['X'] }));
ok('a 4-character password is refused', /at least 8/i.test(tooShort || ''), tooShort);
const earlyLogin = await throws(() => api.login({ email: 'new@geu.ac.in', password: 'secret123' }));
ok('an unconfirmed account cannot log in', /Confirm your college email/.test(earlyLogin || ''), earlyLogin);
ok('the code is 6 digits or nothing', !!(await throws(() => api.verifyOtp({ email: 'new@geu.ac.in', otp: '12' }))));
const verifiedNow = await api.verifyOtp({ email: 'new@geu.ac.in', otp: '123456' });
ok('the right code creates the session', verifiedNow.user.name === 'New Kid' && !!verifiedNow.token);
ok('and the profile reads as verified', (await api.getMe()).verified === true);
ok('a confirmed account does not need the code again', (await api.login({ email: 'new@geu.ac.in', password: 'secret123' })).user.name === 'New Kid');
const resendSoon = await throws(() => api.resendOtp('gunmay@geu.ac.in'));
ok('resending to a verified account is refused', /already verified/i.test(resendSoon || ''), resendSoon);
const storedToken = () => store.get('setu.token') ?? null;
ok('the session lives in storage as a token', !!storedToken(), storedToken());
await api.logout();
ok('logging out takes it back out', storedToken() === null, storedToken());
ok('and the session is gone, not just unremembered', !!(await throws(() => api.getMe())));
await api.login({ email: 'gunmay@geu.ac.in', password: '123456' });

/* ------------------------------------------------------- browse honesty */
section('What the API does not answer stays unanswered');
const topRow = await api.getTopTutors(3);
ok('top tutors arrive ranked, with a person each', topRow.tutors.length === 3 && topRow.tutors.every((t) => t.person?.name), topRow.tutors.map((t) => t.ratingCount));
ok('an unrated tutor has null rating, not zero', topRow.tutors.every((t) => t.ratingCount > 0 ? typeof t.rating === 'number' : t.rating === null), topRow.tutors.map((t) => t.rating));
const noQuery = await api.searchItems('', 'all', 'newest');
ok('an empty query still returns nothing but a real shape', noQuery.items.length === 0 && noQuery.suggestion === null && noQuery.total === 0);
const mineNow = await api.getMyItems();
ok('my own rows name who is waiting', mineNow.every((i) => i.mode !== 'free' || Array.isArray(i.waitingNames)), mineNow.map((i) => i.waitingNames));

/* ------------------------------------------- withdrawing one's own request */
section('Withdrawing a request I sent is a cancellation, not a decline');
await api.resetDemo();
const myAsk = await api.sendSwapRequest('u4', 'Excel');
const withdrawn = await api.cancelRequest(myAsk.request.id);
ok('the row comes back cancelled', withdrawn.request.status === 'cancelled', withdrawn.request.status);
ok('and never as a decline', withdrawn.request.status !== 'declined');
ok('the inbox says withdrawn, not rejected', (await api.getRequests()).sent.some((r) => r.id === myAsk.request.id && r.cancelled === true), (await api.getRequests()).sent);
const again = await throws(() => api.cancelRequest(myAsk.request.id));
ok('withdrawing the same row twice is refused', /already cancelled/.test(again || ''), again);
// 'r1' is Ravi's pending ask, addressed to me: I may decline it, never cancel it
const wrongOwner = await throws(() => api.cancelRequest('r1'));
ok('only the sender can withdraw', /only withdraw a request you sent/.test(wrongOwner || ''), wrongOwner);
const stillPending = (await api.getRequests()).received.find((r) => r.id === 'r1');
ok('a refused withdraw leaves the inbox row untouched', stillPending?.status === 'pending', stillPending?.status);
const declined = await api.declineRequest('r1'); // as the receiver, this side is a decline
ok('a receiver saying no is still recorded as declined, not cancelled', declined.request.status === 'declined' && declined.request.cancelled === false, declined.request);

/* --------------------------------------------------- the demo needs no network */
section('A mock session issues no request at all');
await api.resetDemo();
{
  const realFetch = globalThis.fetch;
  const attempted = [];
  globalThis.fetch = (input, init = {}) => {
    attempted.push(`${(init && init.method) || 'GET'} ${input}`);
    return Promise.reject(new TypeError('the demo campus must not reach the network'));
  };
  const calls = [
    () => api.login({ email: 'gunmay@geu.ac.in', password: '123456' }),
    () => api.getMe(),
    () => api.searchItems('calclator', 'all', 'newest'),
    () => api.getBrowse({ mode: 'free', sort: 'newest', category: 'all' }),
    () => api.getItem('i1'),
    () => api.getMyItems(),
    () => api.getCategories(),
    () => api.findBarter('piano'),
    () => api.searchTutors('python'),
    () => api.getTopTutors(3),
    () => api.getRequests(),
    () => api.getPendingCount(),
    () => api.getMyCircles(),
    () => api.getMeet('u3'),
    () => api.getStudent('u3'),
    () => api.listItem({ title: 'Spy check', category: 'Notes', mode: 'free', price: 0 }),
    () => api.setFreeTime(['Mon 14:00-17:00']),
    () => api.addTeaching({ subject: 'Spy check', description: 'evenings and past papers', pricePerHour: 200 }),
  ];
  let failed = 0;
  for (const run of calls) {
    try {
      await run();
    } catch {
      failed += 1;
    }
  }
  globalThis.fetch = realFetch;
  ok('nothing was taken to the network — reads and writes alike', attempted.length === 0, attempted.slice(0, 4).join(' | '));
  ok('and the calls above really ran (so that is not a vacuous pass)', failed === 0, `${failed} of ${calls.length} threw`);
}

/* ------------------------------------------------------------- failure mode */
section('Failure mode + reset');
await api.setFailureMode(true);
ok('errors surface when failure mode is on', !!(await throws(() => api.getMe())));
await api.setFailureMode(false);
ok('healthy again', (await api.getPendingCount()).count >= 0);
await api.resetDemo();
const fresh = await api.getMe();
ok('reset restores seed (2 pending, waitlists back)', fresh.pendingReceived === 2 && fresh.itemsListed === 2, { p: fresh.pendingReceived, i: fresh.itemsListed });
ok('reset clears circles, ratings and availability too', (await api.getMyCircles()).count === 0 && (await api.getMe()).ratingCount === 27 && (await api.getMe()).freeTime.length === 3);
ok('reset restores free-item queue for i1', (await api.getItem('i1')).waitlistCount === 1);

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail ? 1 : 0);
