async (page) => {
  const startedAt = new Date().toISOString();
  const consoleEntries = [];
  const pageErrors = [];
  const requestFailures = [];
  const httpErrors = [];
  const requests = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleEntries.push({ type: message.type(), text: message.text(), at: new Date().toISOString() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push({ message: error.message, at: new Date().toISOString() }));
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));
  page.on('requestfailed', (request) => requestFailures.push({
    method: request.method(),
    url: request.url(),
    error: request.failure()?.errorText ?? 'unknown',
    at: new Date().toISOString()
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) httpErrors.push({
      method: response.request().method(),
      status: response.status(),
      url: response.url(),
      at: new Date().toISOString()
    });
  });

  const url = 'http://127.0.0.1:49816/';
  const screenshots = {
    profile: 'output/playwright/final-integration-profile-open.png',
    market: 'output/playwright/final-integration-market-open.png',
    keyboard: 'output/playwright/final-integration-keyboard-listbox.png',
    pointer: 'output/playwright/final-integration-pointer-wheel.png',
    ownerCancel: 'output/playwright/final-integration-owner-cancel.png'
  };
  const nextFrame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const activeElement = () => page.evaluate(() => {
    const element = document.activeElement;
    return {
      tag: element?.tagName ?? null,
      role: element?.getAttribute('role') ?? null,
      tabIndex: element instanceof HTMLElement ? element.tabIndex : null,
      ariaLabel: element?.getAttribute('aria-label') ?? null,
      className: element instanceof HTMLElement ? element.className : null,
      activeDescendant: element?.getAttribute('aria-activedescendant') ?? null,
      insideShell: Boolean(document.querySelector('.wildz-shell-overlay')?.contains(element)),
      isCompanion: Boolean(element?.classList?.contains('wilds-companion-command')),
      isProfileOrigin: Boolean(element?.classList?.contains('wildz-explorer-capsule')),
      isToolsOrigin: Boolean(element?.classList?.contains('wilds-world-tools-trigger'))
    };
  });
  const worldState = () => page.evaluate(() => {
    const mapLabel = document.querySelector('.wildz-minimap')?.getAttribute('aria-label') ?? '';
    const coordinates = /X (-?\d+), Z (-?\d+)/.exec(mapLabel);
    const choice = document.querySelector('.wildz-creature-choice[aria-pressed="true"]');
    const xpText = choice?.querySelector('.wildz-creature-choice-copy small')?.textContent ?? '';
    const bondText = choice?.querySelector('.wildz-creature-choice-copy em')?.textContent ?? '';
    return {
      x: coordinates ? Number(coordinates[1]) : null,
      z: coordinates ? Number(coordinates[2]) : null,
      mapLabel,
      energy: Number(document.querySelector('.wildz-explorer-energy')?.getAttribute('aria-valuenow') ?? NaN),
      xp: Number(/(\d+) XP/.exec(xpText)?.[1] ?? NaN),
      bond: Number(/Bond (\d+)/.exec(bondText)?.[1] ?? NaN),
      event: document.querySelector('.wilds-event-toast')?.textContent?.trim() ?? null,
      selectedAbility: document.querySelector('.wilds-companion-power-label')?.textContent?.trim() ?? null
    };
  });
  const focusSequence = async (count) => {
    const sequence = [];
    for (let index = 0; index < count; index += 1) {
      await page.keyboard.press('Tab');
      await nextFrame();
      sequence.push(await activeElement());
    }
    return sequence;
  };
  const waitForWorldChange = async (before) => {
    await page.waitForFunction((prior) => {
      const energy = Number(document.querySelector('.wildz-explorer-energy')?.getAttribute('aria-valuenow') ?? NaN);
      const choice = document.querySelector('.wildz-creature-choice[aria-pressed="true"]');
      const xp = Number(/(\d+) XP/.exec(choice?.querySelector('.wildz-creature-choice-copy small')?.textContent ?? '')?.[1] ?? NaN);
      const bond = Number(/Bond (\d+)/.exec(choice?.querySelector('.wildz-creature-choice-copy em')?.textContent ?? '')?.[1] ?? NaN);
      const event = document.querySelector('.wilds-event-toast')?.textContent?.trim() ?? null;
      return energy !== prior.energy || xp !== prior.xp || bond !== prior.bond || event !== prior.event;
    }, before, { timeout: 5000 });
  };
  const closeTopDialog = async () => {
    const dialog = page.locator('[role="dialog"][aria-modal="true"]').last();
    if (await dialog.count()) {
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached', timeout: 5000 });
      await nextFrame();
    }
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.wildz-world-controls').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(500);

  const production = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    userAgent: navigator.userAgent,
    canvasCount: document.querySelectorAll('canvas').length,
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    scriptChunks: Array.from(document.scripts).map((script) => script.src).filter((src) => src.includes('/_next/static/'))
  }));

  const profileBefore = await worldState();
  await page.locator('.wildz-explorer-capsule').click();
  const profileDialog = page.getByRole('dialog', { name: 'profile panel' });
  await profileDialog.waitFor();
  await nextFrame();
  const profileOpen = await page.evaluate(() => ({
    worldInert: document.querySelector('.wildz-app')?.hasAttribute('inert') ?? false,
    worldAriaHidden: document.querySelector('.wildz-app')?.getAttribute('aria-hidden') ?? null,
    utilityInert: document.querySelector('.wildz-utility-dock')?.hasAttribute('inert') ?? false,
    dialogModal: document.querySelector('.wildz-shell-overlay')?.getAttribute('aria-modal') ?? null
  }));
  const profileInitialFocus = await activeElement();
  await page.keyboard.press('KeyW');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('KeyA');
  await page.locator('.wilds-companion-command').dispatchEvent('click');
  await page.locator('.wilds-companion-command').dispatchEvent('click');
  await page.waitForTimeout(80);
  const profileAfterBlockedInput = await worldState();
  const profileTabSequence = await focusSequence(12);
  await page.screenshot({ path: screenshots.profile });
  await page.keyboard.press('Escape');
  await profileDialog.waitFor({ state: 'detached' });
  await nextFrame();
  const profileRestoredFocus = await activeElement();

  await page.getByRole('button', { name: 'Open world tools' }).click();
  await page.getByRole('button', { name: /Card Vault/ }).click();
  await page.getByRole('button', { name: 'Open Market' }).click();
  const marketDialog = page.getByRole('dialog', { name: 'market panel' });
  await marketDialog.waitFor();
  await nextFrame();
  const marketOpen = await page.evaluate(() => ({
    worldInert: document.querySelector('.wildz-app')?.hasAttribute('inert') ?? false,
    worldAriaHidden: document.querySelector('.wildz-app')?.getAttribute('aria-hidden') ?? null,
    localUnavailable: document.body.innerText.includes('Connect your Receiz ID to load live market listings.'),
    listingsRequestCount: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/api/market/listings')).length
  }));
  const marketInitialFocus = await activeElement();
  const marketTabSequence = await focusSequence(12);
  await page.screenshot({ path: screenshots.market });
  await page.keyboard.press('Escape');
  await marketDialog.waitFor({ state: 'detached' });
  await nextFrame();
  const marketRestoredFocus = await activeElement();

  const companion = page.locator('.wilds-companion-command');
  await companion.focus();
  await page.keyboard.press('KeyA');
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'listbox');
  const abilityInitial = await page.evaluate(() => {
    const listbox = document.activeElement;
    const id = listbox?.getAttribute('aria-activedescendant');
    const option = id ? document.getElementById(id) : null;
    return {
      activeElementTag: listbox?.tagName ?? null,
      role: listbox?.getAttribute('role') ?? null,
      tabIndex: listbox instanceof HTMLElement ? listbox.tabIndex : null,
      activeDescendant: id,
      optionRole: option?.getAttribute('role') ?? null,
      optionSelected: option?.getAttribute('aria-selected') ?? null,
      optionLabel: option?.textContent?.trim() ?? null
    };
  });
  const abilityArrowRows = [];
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    const before = await worldState();
    const priorActiveDescendant = await page.evaluate(() => document.activeElement?.getAttribute('aria-activedescendant'));
    await page.keyboard.press(key);
    await page.waitForTimeout(20);
    const after = await worldState();
    const semantics = await page.evaluate(() => {
      const listbox = document.activeElement;
      const id = listbox?.getAttribute('aria-activedescendant');
      const option = id ? document.getElementById(id) : null;
      return {
        activeElementRole: listbox?.getAttribute('role') ?? null,
        activeDescendant: id,
        selectedOptionCount: document.querySelectorAll('[role="option"][aria-selected="true"]').length,
        selectedOptionRole: option?.getAttribute('role') ?? null,
        selectedOptionAriaSelected: option?.getAttribute('aria-selected') ?? null,
        selectedOptionLabel: option?.textContent?.trim() ?? null
      };
    });
    abilityArrowRows.push({ key, priorActiveDescendant, beforePosition: { x: before.x, z: before.z }, afterPosition: { x: after.x, z: after.z }, ...semantics });
  }
  await page.keyboard.press('ArrowRight');
  await page.screenshot({ path: screenshots.keyboard });
  const keyboardBeforeCommit = await worldState();
  await page.keyboard.press('Enter');
  await nextFrame();
  const keyboardCommittedFocus = await activeElement();
  const keyboardCommittedLabel = (await worldState()).selectedAbility;
  const keyboardBeforeAction = await worldState();
  await page.keyboard.press('Enter');
  await waitForWorldChange(keyboardBeforeAction);
  const keyboardAfterAction = await worldState();
  const keyboardDialogOpened = await page.locator('[role="dialog"][aria-modal="true"]').count() > 0;
  await closeTopDialog();
  await companion.focus();
  await page.keyboard.press('KeyA');
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'listbox');
  await page.keyboard.press('Escape');
  await nextFrame();
  const normalCancelFocus = await activeElement();

  await companion.evaluate((element) => {
    window.__wildzPointerAudit = { lastPointerId: null, events: [] };
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'gotpointercapture', 'lostpointercapture']) {
      element.addEventListener(type, (event) => {
        window.__wildzPointerAudit.lastPointerId = event.pointerId;
        window.__wildzPointerAudit.events.push({ type, pointerId: event.pointerId, at: performance.now() });
      });
    }
  });
  const pointerBox = await companion.boundingBox();
  if (!pointerBox) throw new Error('companion_button_missing');
  const pointerX = pointerBox.x + pointerBox.width / 2;
  const pointerY = pointerBox.y + pointerBox.height / 2;
  const pointerBefore = await worldState();
  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await page.waitForTimeout(130);
  const pointerCaptureDuringHold = await companion.evaluate((element) => {
    const id = window.__wildzPointerAudit.lastPointerId;
    return { pointerId: id, hasCapture: id === null ? false : element.hasPointerCapture(id) };
  });
  await page.mouse.move(pointerX, pointerY - 45, { steps: 4 });
  await page.waitForTimeout(30);
  const pointerSelected = await page.evaluate(() => ({
    label: document.querySelector('[role="option"][aria-selected="true"]')?.textContent?.trim() ?? null,
    activeDescendant: document.querySelector('[role="listbox"]')?.getAttribute('aria-activedescendant') ?? null
  }));
  await page.screenshot({ path: screenshots.pointer });
  await page.mouse.up();
  await nextFrame();
  const pointerCaptureAfterRelease = await companion.evaluate((element) => {
    const audit = window.__wildzPointerAudit;
    const id = audit.lastPointerId;
    return { pointerId: id, hasCapture: id === null ? false : element.hasPointerCapture(id), events: audit.events };
  });
  const pointerCommittedLabel = (await worldState()).selectedAbility;
  const pointerBeforeAction = await worldState();
  await companion.click();
  await waitForWorldChange(pointerBeforeAction);
  const pointerAfterAction = await worldState();
  const pointerDialogOpened = await page.locator('[role="dialog"][aria-modal="true"]').count() > 0;
  await closeTopDialog();

  await companion.focus();
  await page.keyboard.press('KeyA');
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'listbox');
  const ownerCancelWheelBefore = await page.evaluate(() => ({
    wheelMounted: Boolean(document.querySelector('[role="listbox"]')),
    active: document.activeElement?.getAttribute('role') ?? null
  }));
  const ownerPointerBox = await companion.boundingBox();
  if (!ownerPointerBox) throw new Error('owner_companion_button_missing');
  const ownerPointerX = ownerPointerBox.x + ownerPointerBox.width / 2;
  const ownerPointerY = ownerPointerBox.y + ownerPointerBox.height / 2;
  await page.mouse.move(ownerPointerX, ownerPointerY);
  await page.mouse.down();
  await page.waitForTimeout(20);
  const ownerCaptureBeforeClaim = await companion.evaluate((element) => {
    const id = window.__wildzPointerAudit.lastPointerId;
    return { pointerId: id, hasCapture: id === null ? false : element.hasPointerCapture(id) };
  });
  await page.locator('.wildz-explorer-capsule').evaluate((element) => element.click());
  const ownerDialog = page.getByRole('dialog', { name: 'profile panel' });
  await ownerDialog.waitFor();
  await nextFrame();
  const ownerCancel = await companion.evaluate((element) => {
    const audit = window.__wildzPointerAudit;
    const id = audit.lastPointerId;
    return {
      wheelMounted: Boolean(document.querySelector('[role="listbox"]')),
      pointerId: id,
      pointerCaptureAfterClaim: id === null ? false : element.hasPointerCapture(id),
      focusInsideShell: Boolean(document.querySelector('.wildz-shell-overlay')?.contains(document.activeElement)),
      companionFocused: document.activeElement === element,
      worldInert: document.querySelector('.wildz-app')?.hasAttribute('inert') ?? false,
      events: audit.events
    };
  });
  await page.screenshot({ path: screenshots.ownerCancel });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await ownerDialog.waitFor({ state: 'detached' });
  await nextFrame();

  await companion.focus();
  await page.keyboard.press('KeyA');
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'listbox');
  await page.keyboard.press('Enter');
  await nextFrame();
  const normalCommitFocus = await activeElement();

  const finishedAt = new Date().toISOString();
  const result = {
    schema: 'wildz.final-integration-evidence.v1',
    startedAt,
    finishedAt,
    productCommit: 'c26ae652894db84868c0343c108c048aa32d0fb4',
    nextBuildId: 'pVMRsX8Mh21tHuB69B34C',
    listenersInstalledBeforeNavigation: true,
    command: '/Users/bjklock/.npm/_npx/31e32ef8478fbf80/node_modules/.bin/playwright-cli --session final-integration-evidence-c26ae65 run-code "$(cat output/playwright/final-integration-evidence-script.js)"',
    script: 'output/playwright/final-integration-evidence-script.js',
    result: 'output/playwright/final-integration-evidence-result.json',
    production,
    listenerEvidence: { consoleEntries, pageErrors, requestFailures, httpErrors, requestCount: requests.length },
    profile: {
      before: profileBefore,
      open: profileOpen,
      initialFocus: profileInitialFocus,
      afterRepeatedBlockedInput: profileAfterBlockedInput,
      repeatedInputBlocked: JSON.stringify(profileBefore) === JSON.stringify(profileAfterBlockedInput),
      tabSequence: profileTabSequence,
      tabStayedInside: profileTabSequence.every((entry) => entry.insideShell),
      restoredFocus: profileRestoredFocus,
      screenshot: screenshots.profile
    },
    market: {
      open: marketOpen,
      initialFocus: marketInitialFocus,
      tabSequence: marketTabSequence,
      tabStayedInside: marketTabSequence.every((entry) => entry.insideShell),
      restoredFocus: marketRestoredFocus,
      listingsRequests: requests.filter((request) => request.url.includes('/api/market/listings')),
      screenshot: screenshots.market
    },
    keyboardAbility: {
      initial: abilityInitial,
      arrows: abilityArrowRows,
      arrowsChangedSelection: abilityArrowRows.every((row) => row.priorActiveDescendant !== row.activeDescendant),
      arrowsKeptPlayerStill: abilityArrowRows.every((row) => row.beforePosition.x === row.afterPosition.x && row.beforePosition.z === row.afterPosition.z),
      beforeCommit: keyboardBeforeCommit,
      committedLabel: keyboardCommittedLabel,
      committedFocus: keyboardCommittedFocus,
      beforeAction: keyboardBeforeAction,
      afterAction: keyboardAfterAction,
      causalChange: {
        energy: keyboardAfterAction.energy - keyboardBeforeAction.energy,
        xp: keyboardAfterAction.xp - keyboardBeforeAction.xp,
        bond: keyboardAfterAction.bond - keyboardBeforeAction.bond,
        eventChanged: keyboardAfterAction.event !== keyboardBeforeAction.event
      },
      dialogOpened: keyboardDialogOpened,
      normalCancelFocus,
      screenshot: screenshots.keyboard
    },
    pointerAbility: {
      before: pointerBefore,
      captureDuringHold: pointerCaptureDuringHold,
      selected: pointerSelected,
      captureAfterRelease: pointerCaptureAfterRelease,
      committedLabel: pointerCommittedLabel,
      beforeAction: pointerBeforeAction,
      afterAction: pointerAfterAction,
      causalChange: {
        energy: pointerAfterAction.energy - pointerBeforeAction.energy,
        xp: pointerAfterAction.xp - pointerBeforeAction.xp,
        bond: pointerAfterAction.bond - pointerBeforeAction.bond,
        eventChanged: pointerAfterAction.event !== pointerBeforeAction.event
      },
      dialogOpened: pointerDialogOpened,
      screenshot: screenshots.pointer
    },
    ownerCancellation: {
      wheelBefore: ownerCancelWheelBefore,
      captureBeforeClaim: ownerCaptureBeforeClaim,
      afterClaim: ownerCancel,
      normalCommitFocus,
      screenshot: screenshots.ownerCancel
    }
  };
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate((json) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    link.download = 'final-integration-evidence-result.json';
    link.click();
  }, JSON.stringify(result, null, 2));
  const download = await downloadPromise;
  await download.saveAs('output/playwright/final-integration-evidence-result.json');
  return result;
}
