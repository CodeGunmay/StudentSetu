/**
 * In-memory mock database + demo seed.
 *
 * The shapes here mirror what the C++ server returns: ids are strings, every
 * account carries `verified`, `freeTime`, `rating` and `ratingCount`, and nothing
 * the server cannot answer is invented (see src/api/adapters.js for that half).
 * Everything the UI shows comes from here (through src/api/index.js only).
 */

const HOUR = 60 * 60 * 1000;

export const CATEGORIES = [
  'Books',
  'Notes',
  'Calculator',
  'Lab equipment',
  'Electronics',
  'Stationery',
  'Clothing',
  'Other',
];

export const BRANCHES = ['CSE', 'IT', 'ECE', 'ME', 'CE', 'Other'];

/** Mock-only login shown in the demo hint (never in a production build). */
export const DEMO_ACCOUNT = { email: 'gunmay@geu.ac.in', password: '123456' };

let clock = Date.now();

/** Fresh copy of all demo data. Called by resetDemo(). */
export function createSeed() {
  clock = Date.now();
  const ago = (hours) => clock - hours * HOUR;

  const users = [
    {
      id: 'u1',
      name: 'Gunmay',
      email: 'gunmay@geu.ac.in',
      password: '123456',
      branch: 'CSE',
      year: 3,
      teaches: ['C++', 'DBMS'],
      wants: ['Python'],
      color: 'indigo',
      verified: true,
      freeTime: ['Mon 14:00-18:00', 'Tue 9:00-11:00', 'Thu 16:00-19:00'],
      rating: 4.9,
      ratingCount: 27,
      joinedAt: ago(24 * 200),
    },
    {
      id: 'u2',
      name: 'Ishwar',
      email: 'ishwar@geu.ac.in',
      password: '123456',
      branch: 'CSE',
      year: 4,
      teaches: ['Python'],
      wants: ['DSA'],
      color: 'emerald',
      verified: true,
      freeTime: ['Wed 10:00-13:00', 'Fri 15:00-17:00'],
      rating: 4.7,
      ratingCount: 35,
      joinedAt: ago(24 * 160),
    },
    {
      id: 'u3',
      name: 'Gaurav',
      email: 'gaurav@geu.ac.in',
      password: '123456',
      branch: 'CSE',
      year: 2,
      teaches: ['DSA'],
      wants: ['C++'],
      color: 'sky',
      verified: true,
      freeTime: ['Mon 9:00-12:00'],
      rating: 0,
      ratingCount: 0,
      joinedAt: ago(24 * 120),
    },
    {
      id: 'u4',
      name: 'Asha',
      email: 'asha@geu.ac.in',
      password: '123456',
      branch: 'ECE',
      year: 3,
      teaches: ['Maths', 'Physics'],
      wants: ['DBMS'],
      color: 'rose',
      verified: true,
      freeTime: ['Tue 9:00-11:00', 'Thu 16:00-19:00', 'Sat 8:00-12:00'],
      rating: 4.8,
      ratingCount: 41,
      joinedAt: ago(24 * 90),
    },
    {
      id: 'u5',
      name: 'Ravi',
      email: 'ravi@geu.ac.in',
      password: '123456',
      branch: 'ME',
      year: 4,
      teaches: ['DBMS'],
      wants: ['Maths'],
      color: 'amber',
      verified: true,
      freeTime: ['Wed 10:00-13:00', 'Thu 17:00-19:00'],
      rating: 4.8,
      ratingCount: 81,
      joinedAt: ago(24 * 60),
    },
  ];

  const items = [
    {
      id: 'i1',
      ownerId: 'u3',
      title: 'Spare calculator',
      category: 'Calculator',
      mode: 'free',
      price: null,
      wants: [],
      condition: 'Good',
      description:
        'Casio fx-991EX. I got a duplicate from home, so this one is free for a junior. Battery cover has a scratch, works perfectly.',
      available: true,
      waitlist: ['u4'],
      createdAt: ago(3),
    },
    {
      id: 'i2',
      ownerId: 'u4',
      title: 'DSA handwritten notes',
      category: 'Notes',
      mode: 'barter',
      price: null,
      wants: ['Physics notes'],
      condition: 'Like new',
      description:
        'Full semester DSA notes — graphs, DP, trees, with the previous year question marks. Neat and exam ready.',
      available: true,
      waitlist: [],
      createdAt: ago(9),
    },
    {
      id: 'i3',
      ownerId: 'u2',
      title: 'Let Us C++ book',
      category: 'Books',
      mode: 'sell',
      price: 250,
      wants: [],
      condition: 'Good',
      description: 'Deitel 4th edition, no torn pages, light highlighting in chapters 1-6. Selling because semester ended.',
      available: true,
      waitlist: [],
      createdAt: ago(20),
    },
    {
      id: 'i4',
      ownerId: 'u5',
      title: 'Lab coat',
      category: 'Lab equipment',
      mode: 'sell',
      price: 150,
      wants: [],
      condition: 'Fair',
      description: 'Standard white lab coat, size M. Two small ink marks on the pocket, washed and ready.',
      available: true,
      waitlist: [],
      createdAt: ago(30),
    },
    {
      id: 'i5',
      ownerId: 'u5',
      title: 'Drafter',
      category: 'Lab equipment',
      mode: 'free',
      price: null,
      wants: [],
      condition: 'Good',
      description: 'Drawing board drafter with ink pen. Free to whoever is in the 1st year drawing batch this week.',
      available: true,
      waitlist: [],
      createdAt: ago(46),
    },
    {
      id: 'i6',
      ownerId: 'u2',
      title: 'Oscilloscope probe kit',
      category: 'Electronics',
      mode: 'sell',
      price: 400,
      wants: [],
      condition: 'Like new',
      description: '10x/1x probes + grab clips, tested on the ECE lab scope. Extra set from project team.',
      available: true,
      waitlist: [],
      createdAt: ago(58),
    },
    {
      id: 'i7',
      ownerId: 'u3',
      title: 'Graph paper pads (50 sheets)',
      category: 'Stationery',
      mode: 'free',
      price: null,
      wants: [],
      condition: 'New',
      description: 'Unused pack, half is fine too. Pickup at B-block hostel.',
      available: true,
      waitlist: [],
      createdAt: ago(70),
    },
    {
      id: 'i8',
      ownerId: 'u1',
      title: 'Object Oriented Programming notes',
      category: 'Notes',
      mode: 'barter',
      price: null,
      wants: ['Python notes'],
      condition: 'Good',
      description: 'My C++ / OOP notes with the lab viva questions at the end. Happy to swap for anything Python related.',
      available: true,
      waitlist: [],
      createdAt: ago(12),
    },
    {
      id: 'i9',
      ownerId: 'u1',
      title: 'Spare desk lamp',
      category: 'Other',
      mode: 'free',
      price: null,
      wants: [],
      condition: 'Good',
      description: 'LED desk lamp with clamp, two brightness levels. Giving it away since I am moving rooms.',
      available: true,
      waitlist: ['u2', 'u4'],
      createdAt: ago(52),
    },
  ];

  const tutorings = [
    {
      id: 't1',
      userId: 'u1',
      subject: 'C++ from basics',
      description: 'Pointers to STL, one evening a week. We solve the lab sheet together, no mugging.',
      pricePerHour: 200,
      active: true,
      rating: 4.9,
      reviews: 27,
      createdAt: ago(100),
    },
    {
      id: 't2',
      userId: 'u4',
      subject: 'Maths for first year',
      description: 'Calculus and matrices, timed to the GEU syllabus. I take 3 students at a time.',
      pricePerHour: 150,
      active: true,
      rating: 4.8,
      reviews: 41,
      createdAt: ago(140),
    },
    {
      id: 't3',
      userId: 'u5',
      subject: 'Maths quick revision',
      description: 'Two sessions before the exam, all the standard question types in one go.',
      pricePerHour: 120,
      active: true,
      rating: 4.6,
      reviews: 18,
      createdAt: ago(150),
    },
    {
      id: 't4',
      userId: 'u5',
      subject: 'DBMS and SQL',
      description: 'Normalisation, joins, indexing and the full ER diagram for the project. Queries on the whiteboard.',
      pricePerHour: 100,
      active: true,
      rating: 4.9,
      reviews: 63,
      createdAt: ago(160),
    },
    {
      id: 't5',
      userId: 'u2',
      subject: 'Python with projects',
      description: 'Basics to a working mini project (pandas or automation). Bring your laptop, we build.',
      pricePerHour: 180,
      active: true,
      rating: 4.7,
      reviews: 35,
      createdAt: ago(170),
    },
  ];

  const requests = [
    {
      id: 'r1',
      fromId: 'u4',
      toId: 'u1',
      type: 'swap',
      skill: 'DBMS',
      listingId: null,
      itemId: null,
      offerItemId: null,
      circleIds: null,
      note: 'Seen you teach DBMS. I can do Maths or Physics in return.',
      status: 'pending',
      autoDeclined: false,
      createdAt: ago(2),
    },
    {
      id: 'r2',
      fromId: 'u3',
      toId: 'u1',
      type: 'item',
      skill: null,
      listingId: 'i8',
      itemId: 'i8',
      offerItemId: 'i1',
      note: 'My spare calculator is yours for the OOP notes.',
      status: 'pending',
      autoDeclined: false,
      createdAt: ago(5),
    },
    {
      id: 'r3',
      fromId: 'u1',
      toId: 'u5',
      type: 'paid',
      skill: null,
      listingId: 't4',
      itemId: null,
      offerItemId: null,
      note: 'Can we start this week? Tue or Thu evening.',
      status: 'accepted',
      autoDeclined: false,
      createdAt: ago(28),
    },
  ];

  // Ratings a student can leave after an accepted exchange. Empty at the start:
  // a rating only exists once somebody actually rated, and the UI must say
  // "No ratings yet" rather than assume a score.
  // The seeded score is a starting base: a student's rating is this base plus
  // whatever is left after someone rates an exchange, never a made-up average.
  users.forEach((u) => {
    u.baseRating = u.rating || 0;
    u.baseCount = u.ratingCount || 0;
  });

  const ratings = [];

  // Circle invitations live in `requests` (one row per member, sharing a
  // circleTag); `circles` only records a circle the student explicitly created.
  const circles = [];

  return {
    users,
    items,
    tutorings,
    requests,
    ratings,
    circles,
    seq: { user: 6, item: 10, tutoring: 6, request: 4, circle: 1, rating: 1 },
    now: () => Date.now(),
  };
}
