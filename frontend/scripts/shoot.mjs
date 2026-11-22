/** Visual capture pass: walks the app in Chromium and saves screenshots. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('shots', { recursive: true });

const BASE = process.env.BASE || 'http://localhost:5173/';
const OUT = (n) => `shots/${String(n).padStart(2, '0')}-${''}`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--force-color-profile=srgb'] });

async function phone({ token = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });
  await ctx.addInitScript(([useToken]) => {
    localStorage.setItem('setu.intro', '1');
    if (useToken) localStorage.setItem('setu.token', 'u1');
    else localStorage.clear();
  }, [token]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  ! pageerror:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('  ! console:', m.text().slice(0, 160)));
  return { ctx, page };
}

let n = 0;
const shot = async (page, name) => {
  n += 1;
  await page.screenshot({ path: `shots/${String(n).padStart(2, '0')}-${name}.png` });
  console.log(`  📸 ${n}-${name}`);
};

const text = async (page) => (await page.textContent('body')) || '';

/* ---------------------------------------------------------------- onboarding */
{
  const { ctx, page } = await phone({ token: false });
  await page.goto(BASE, { waitUntil: 'load' });
  await shot(page, 'splash');
  await page.waitForTimeout(1900);
  await shot(page, 'onboarding-swap-skills');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'onboarding-seniors');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'login');
  await page.locator('#login-password').fill('9999');
  await page.locator('#login-email').fill('gunmay@geu.ac.in');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForTimeout(900);
  await shot(page, 'login-error');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.waitForTimeout(400);
  await page.locator('#reg-email').fill('sam@gmail.com');
  await page.locator('#reg-name').fill('Sam');
  await page.getByRole('button', { name: 'Join StudentSetu' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'register-validation');
  await ctx.close();
}

/* -------------------------------------------------------------------- home */
const { ctx, page } = await phone();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(2200);
await shot(page, 'home');
await page.evaluate(() => document.querySelector('[data-scroll]')?.scrollTo({ top: 420 }));
await page.waitForTimeout(500);
await shot(page, 'home-carousels');
await page.evaluate(() => document.querySelector('[data-scroll]')?.scrollTo({ top: 0 }));

/* ------------------------------------------------------------------- items */
await page.getByRole('button', { name: 'Items', exact: true }).click();
await page.waitForTimeout(900);
await shot(page, 'items-browse');
await page.locator('#setu-search').fill('calclator');
await page.waitForTimeout(1200);
await shot(page, 'items-search-typo');
await page.locator('#setu-search').fill('notes');
await page.waitForTimeout(1200);
await page.getByText('DSA handwritten notes').first().click();
await page.waitForTimeout(1000);
await shot(page, 'item-detail-barter');
await page.getByRole('button', { name: /Offer one of your items/ }).click();
await page.waitForTimeout(700);
await shot(page, 'item-offer-sheet');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Go back' }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'Free', exact: true }).click();
await page.waitForTimeout(900);
await page.getByText('Spare calculator').first().click();
await page.waitForTimeout(1000);
await shot(page, 'item-detail-free');
await page.getByRole('button', { name: /Join waitlist/ }).click();
await page.waitForTimeout(1100);
await shot(page, 'item-waitlist-joined');
await page.getByRole('button', { name: 'Go back' }).click();
await page.waitForTimeout(800);
await page.getByRole('tab', { name: 'My items' }).click();
await page.waitForTimeout(1000);
await shot(page, 'items-mine');
await page.getByRole('button', { name: 'List an item' }).click();
await page.waitForTimeout(600);
await shot(page, 'list-item-empty');
await page.locator('#li-title').fill('Mechanical drawing set');
await page.getByRole('button', { name: 'Sell' }).click();
await page.locator('#li-price').fill('350');
await page.waitForTimeout(400);
await shot(page, 'list-item-sell');
await page.getByRole('button', { name: /Post to the campus board/ }).click();
await page.waitForTimeout(1300);
await shot(page, 'list-item-success');

/* ------------------------------------------------------------------ skills */
await page.getByRole('button', { name: 'Skills', exact: true }).click();
await page.waitForTimeout(900);
await shot(page, 'skills-barter-idle');
await page.locator('#barter-skill').fill('python');
await page.getByRole('button', { name: 'Find swaps' }).click();
await page.waitForTimeout(1400);
await shot(page, 'skills-exchange-circle');
await page.getByRole('tab', { name: 'Paid' }).click();
await page.waitForTimeout(1200);
await shot(page, 'skills-paid-learn');
await page.getByRole('button', { name: /Request session/ }).first().click();
await page.waitForTimeout(700);
await shot(page, 'skills-paid-sheet');
await page.keyboard.press('Escape');
await page.getByRole('tab', { name: 'Teach' }).click();
await page.waitForTimeout(1000);
await shot(page, 'skills-paid-teach');

/* ---------------------------------------------------------------- activity */
await page.getByRole('button', { name: 'Activity' }).click();
await page.waitForTimeout(1200);
await shot(page, 'activity-received');
await page.getByRole('button', { name: /Accept/ }).first().click();
await page.waitForTimeout(1300);
await shot(page, 'activity-accepted-contact');
await page.getByRole('tab', { name: 'Sent' }).click();
await page.waitForTimeout(900);
await shot(page, 'activity-sent');

/* ----------------------------------------------------------------- profile */
await page.getByRole('button', { name: 'Open your profile' }).click();
await page.waitForTimeout(900);
await shot(page, 'profile');
await page.locator('button[role="switch"]').first().click();
await page.waitForTimeout(700);
await shot(page, 'profile-dark');
await page.getByRole('button', { name: /Edit skills/ }).first().click();
await page.waitForTimeout(800);
await shot(page, 'profile-skills-sheet');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.locator('button[aria-label="Force API errors"]').click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Items', exact: true }).click();
await page.waitForTimeout(1200);
await shot(page, 'error-state');

/* ----------------------------------------------------------------- desktop */
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await desk.addInitScript(() => localStorage.setItem('setu.token', 'u1'));
const dpage = await desk.newPage();
await dpage.goto(BASE, { waitUntil: 'load' });
await dpage.waitForTimeout(2200);
await dpage.screenshot({ path: 'shots/90-desktop-frame.png' });
console.log('  📸 90-desktop-frame');
await dpage.evaluate(() => document.documentElement.classList.add('dark'));
await dpage.waitForTimeout(400);
await dpage.screenshot({ path: 'shots/91-desktop-dark.png' });
console.log('  📸 91-desktop-dark');

await ctx.close();
await desk.close();
await browser.close();
console.log('done');
