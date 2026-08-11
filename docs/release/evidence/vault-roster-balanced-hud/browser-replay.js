async (page) => {
  const baseUrl = "http://127.0.0.1:49817/";
  const expected = {
    vault: { id: "wilds:123e00f59899025a366d578f", name: "Toiusap", ability: "Stone Pulse", stats: { health: 63, power: 79, guard: 76, speed: 77, bond: 53 } },
    slate: { id: "wilds:223616f27f33bc5b5fa273d9", name: "Neiatid", ability: "Tide Pulse", stats: { health: 87, power: 61, guard: 69, speed: 47, bond: 55 } }
  };
  const viewports = [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];
  const consoleEntries = [];
  const pageErrors = [];
  const responses = [];
  const failedRequests = [];
  page.on("console", (message) => consoleEntries.push({ type: message.type(), text: message.text() }));
  page.on("pageerror", (error) => pageErrors.push({ name: error.name, message: error.message }));
  page.on("response", (response) => responses.push({ method: response.request().method(), status: response.status(), url: response.url() }));
  page.on("requestfailed", (request) => failedRequests.push({ method: request.method(), url: request.url(), error: request.failure()?.errorText ?? null }));

  const client = await page.context().newCDPSession(page);
  await client.send("Network.setBypassServiceWorker", { bypass: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".wildz-world-controls");
  await page.waitForTimeout(600);

  const rect = async (locator) => {
    if (!(await locator.count())) return null;
    const box = await locator.first().boundingBox();
    return box ? { x: box.x, y: box.y, width: box.width, height: box.height, right: box.x + box.width, bottom: box.y + box.height } : null;
  };
  const activeProof = async () => page.evaluate(() => {
    const command = document.querySelector(".wilds-companion-command");
    const portraitSvg = document.querySelector(".wilds-companion-active-portrait svg");
    const activeShell = Array.from(document.querySelectorAll("[data-wildz-card-id]")).find((shell) => shell.querySelector('[aria-pressed="true"]'));
    return {
      command: command?.getAttribute("aria-label") ?? null,
      commandName: document.querySelector(".wilds-companion-real-name")?.textContent ?? null,
      commandAbility: document.querySelector(".wilds-companion-power-label")?.textContent ?? null,
      commandPosition: command?.querySelector("small")?.textContent ?? null,
      portraitTitle: portraitSvg?.querySelector("title")?.textContent ?? portraitSvg?.getAttribute("aria-label") ?? null,
      portraitMarkupDigestBasis: portraitSvg?.outerHTML.slice(0, 180) ?? null,
      worldActorLabels: Array.from(document.querySelectorAll(".wilds-world-label span")).map((node) => node.textContent),
      activeAssetId: activeShell?.getAttribute("data-wildz-card-id") ?? null
    };
  });
  const reloadProof = async () => {
    await client.send("Network.setBypassServiceWorker", { bypass: true });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".wilds-companion-command");
    await page.waitForTimeout(500);
    return { ...(await activeProof()), serviceWorkerBypassed: await page.evaluate(() => navigator.serviceWorker.controller === null) };
  };
  const dismiss = async () => {
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(35);
    }
    for (const label of ["Close player interaction", "Close live roster"]) {
      const close = page.getByRole("button", { name: label });
      if (await close.count() && await close.first().isVisible()) await close.first().click();
    }
    const audio = page.locator('.wilds-audio-settings[open] > summary');
    if (await audio.count()) await audio.click();
  };
  const assertActive = (proof, card, step) => {
    if (!proof.command?.startsWith(`${card.name}.`)) throw new Error(`${step}: command did not use ${card.name}`);
    if (proof.commandName !== card.name || proof.commandAbility !== card.ability) throw new Error(`${step}: portrait command copy mismatch`);
    if (!proof.worldActorLabels.includes(card.name)) throw new Error(`${step}: world actor did not use ${card.name}`);
    if (proof.activeAssetId !== card.id) throw new Error(`${step}: active asset id mismatch: ${proof.activeAssetId}`);
  };

  await dismiss();
  const initialActive = await activeProof();
  if (initialActive.commandName === expected.vault.name) {
    const setupCommand = page.locator(".wilds-companion-command");
    await setupCommand.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction((name) => document.querySelector(".wilds-companion-command")?.getAttribute("aria-label")?.startsWith(`${name}.`), expected.slate.name);
    await page.waitForTimeout(600);
  }
  await page.getByRole("button", { name: "Open world tools" }).click();
  await page.getByRole("button", { name: /^Card Vault/ }).click();
  await page.getByRole("dialog", { name: "Card Vault" }).waitFor();
  const vaultCards = await page.locator(".wilds-inventory-grid > button").evaluateAll((buttons) => buttons.map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? ""));
  if (vaultCards.length !== 2) throw new Error(`expected two real Vault cards, received ${vaultCards.length}`);
  const readVaultManifest = async (card) => {
    await page.locator(".wilds-inventory-grid > button").filter({ hasText: card.name }).click();
    await page.waitForFunction((name) => document.querySelector(".wilds-inventory-detail")?.textContent?.includes(name), card.name);
    const proof = await page.evaluate(({ name, id }) => {
      const detail = document.querySelector(".wilds-inventory-detail");
      const rawText = detail?.textContent ?? "";
      const compactText = rawText.replace(/\s+/g, " ").trim();
      const statsMatch = rawText.replace(/\s+/g, "").match(/Health(\d+)Power(\d+)Guard(\d+)Speed(\d+)Bond(\d+)/i);
      const standalone = Array.from(detail?.querySelectorAll("a") ?? []).find((link) => link.textContent?.includes("standalone"));
      return {
        assetId: id,
        manifestName: name,
        namePresent: rawText.includes(name),
        source: "live Card Vault sealed-manifest DOM",
        stats: statsMatch ? { health: Number(statsMatch[1]), power: Number(statsMatch[2]), guard: Number(statsMatch[3]), speed: Number(statsMatch[4]), bond: Number(statsMatch[5]) } : null,
        text: compactText.slice(0, 520),
        standaloneHref: standalone?.getAttribute("href") ?? null
      };
    }, card);
    if (proof.standaloneHref !== `/cards/${encodeURIComponent(card.id)}`) throw new Error(`${card.name} exact id href mismatch: ${proof.standaloneHref}`);
    if (JSON.stringify(proof.stats) !== JSON.stringify(card.stats)) throw new Error(`${card.name} live manifest stats mismatch: ${JSON.stringify(proof.stats)}`);
    return proof;
  };
  const vaultManifests = {
    Toiusap: await readVaultManifest(expected.vault),
    Neiatid: await readVaultManifest(expected.slate)
  };
  await page.locator(".wilds-inventory-grid > button").filter({ hasText: expected.vault.name }).click();
  await page.waitForFunction((name) => document.querySelector(".wilds-inventory-detail")?.textContent?.includes(name), expected.vault.name);
  await page.getByRole("button", { name: "Set as active deck leader" }).click();
  await page.waitForFunction((name) => document.querySelector(".wilds-companion-command")?.getAttribute("aria-label")?.startsWith(`${name}.`), expected.vault.name);
  await page.screenshot({ path: "output/playwright/task5-card-vault-toiusap-final.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(160);
  const vaultSelected = await activeProof();
  assertActive(vaultSelected, expected.vault, "Card Vault selection");
  const vaultReloaded = await reloadProof();
  assertActive(vaultReloaded, expected.vault, "Card Vault reload");

  const command = page.locator(".wilds-companion-command");
  await command.focus();
  await page.keyboard.press("ArrowUp");
  await page.locator(".wildz-creature-drawer").waitFor();
  const slateEntries = await page.locator("[data-wildz-card-id]").evaluateAll((shells) => shells.map((shell) => ({
    id: shell.getAttribute("data-wildz-card-id"),
    label: shell.querySelector("button")?.getAttribute("aria-label") ?? null,
    active: shell.querySelector("button")?.getAttribute("aria-pressed") === "true"
  })));
  const neiatidButton = page.getByRole("button", { name: new RegExp(`^${expected.slate.name}, level`) });
  const neiatidBox = await neiatidButton.boundingBox();
  await neiatidButton.click({ timeout: 3000 });
  await page.waitForFunction((name) => document.querySelector(".wilds-companion-command")?.getAttribute("aria-label")?.startsWith(`${name}.`), expected.slate.name);
  await page.screenshot({ path: "output/playwright/task5-slate-neiatid-final.png" });
  const slateSelected = await activeProof();
  assertActive(slateSelected, expected.slate, "Slate selection");
  await page.waitForTimeout(600);
  const slateReloaded = await reloadProof();
  assertActive(slateReloaded, expected.slate, "Slate reload");

  const geometry = async () => page.evaluate(() => {
    const selectorMap = {
      explorer: ".wildz-explorer-capsule",
      mission: ".wildz-mission-chip",
      minimapStatus: ".wilds-map-status-home",
      kaiAudio: ".wilds-left-instrument-home",
      movement: ".wildz-movement-home",
      tools: ".wildz-tools-home",
      companion: ".wildz-companion-home"
    };
    const items = Object.fromEntries(Object.entries(selectorMap).map(([key, selector]) => {
      const root = document.querySelector(selector);
      if (!(root instanceof HTMLElement)) return [key, null];
      const nodes = key === "minimapStatus"
        ? [document.querySelector(".wildz-map-home > .wildz-minimap"), ...root.querySelectorAll("button")]
        : key === "kaiAudio" ? [...root.querySelectorAll("button, summary")] : [root];
      const rects = nodes.filter((node) => node instanceof HTMLElement && getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden").map((node) => node.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) return [key, null];
      const left = Math.min(...rects.map((r) => r.left)); const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right)); const bottom = Math.max(...rects.map((r) => r.bottom));
      return [key, { x: left, y: top, width: right - left, height: bottom - top, right, bottom }];
    }));
    const surfaceGroups = {
      explorer: [document.querySelector(".wildz-explorer-capsule")],
      mission: [document.querySelector(".wildz-mission-chip")],
      minimapStatus: [document.querySelector(".wildz-map-home > .wildz-minimap"), ...document.querySelectorAll(".wilds-map-status-home button")],
      kaiAudio: [...document.querySelectorAll(".wilds-left-instrument-home button, .wilds-left-instrument-home summary")],
      movement: [document.querySelector(".wildz-movement-home .wildz-dpad"), ...document.querySelectorAll(".wildz-movement-home .wildz-quick-utilities button")],
      tools: [document.querySelector(".wilds-world-tools-trigger")],
      companion: [document.querySelector(".wilds-companion-command")]
    };
    const visible = Object.entries(surfaceGroups).flatMap(([key, nodes]) => nodes.filter((node) => node instanceof HTMLElement && getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden").map((node, index) => {
      const r = node.getBoundingClientRect();
      return [`${key}:${index}`, { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }];
    })).filter((entry) => entry[1].width > 0 && entry[1].height > 0);
    const collisions = [];
    for (let a = 0; a < visible.length; a += 1) for (let b = a + 1; b < visible.length; b += 1) {
      const [ak, ar] = visible[a]; const [bk, br] = visible[b];
      if (ak.split(":")[0] === bk.split(":")[0]) continue;
      const width = Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.x, br.x));
      const height = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.y, br.y));
      collisions.push({ a: ak, b: bk, area: width * height, width, height });
    }
    const targetElements = [...new Set(Object.values(selectorMap).flatMap((selector) => {
      const root = document.querySelector(selector);
      if (!(root instanceof HTMLElement)) return [];
      return [
        ...(root.matches("button, summary") ? [root] : []),
        ...root.querySelectorAll("button, summary")
      ];
    }))];
    const targets = targetElements.filter((element) => {
      const style = getComputedStyle(element); const r = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && r.width > 0 && r.height > 0;
    }).map((element) => { const r = element.getBoundingClientRect(); return { label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 50) ?? null, width: r.width, height: r.height, floor44: r.width >= 44 && r.height >= 44 }; });
    const canvas = document.querySelector("canvas");
    const canvasRect = canvas?.getBoundingClientRect();
    let diagnostics = null;
    try { diagnostics = JSON.parse(canvas?.getAttribute("data-three-game-diagnostics") ?? "null"); } catch {}
    return {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      document: { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth - innerWidth, overflowY: document.documentElement.scrollHeight - innerHeight },
      openSurfaces: {
        slate: document.querySelector(".wildz-creature-drawer:not(.is-closed)") ? 1 : 0,
        liveRoster: document.querySelectorAll(".wilds-live-roster").length,
        playerInteraction: document.querySelectorAll(".wilds-player-sheet").length,
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        audioSheets: document.querySelectorAll(".wilds-audio-settings[open]").length
      },
      canvas: canvas && canvasRect ? { display: { x: canvasRect.x, y: canvasRect.y, width: canvasRect.width, height: canvasRect.height }, drawingBuffer: { width: canvas.width, height: canvas.height } } : null,
      diagnostics,
      homes: items,
      safeBounds: visible.map(([key, r]) => ({ key, pass: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight })),
      collisions,
      positiveCollisions: collisions.filter((collision) => collision.area > 1),
      targets,
      targetFloorFailures: targets.filter((target) => !target.floor44)
    };
  });

  const matrix = [];
  for (const viewport of viewports) {
    await dismiss();
    await page.setViewportSize(viewport);
    await page.waitForTimeout(140);
    const size = `${viewport.width}x${viewport.height}`;
    const resting = await geometry();
    await page.screenshot({ path: `output/playwright/task5-resting-${size}.png` });

    await command.focus();
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(80);
    const preview = { rect: await rect(page.locator(".wildz-creature-drawer")), className: await page.locator(".wildz-creature-drawer").getAttribute("class"), entries: await page.locator(".wildz-creature-choice").count() };
    await page.getByRole("button", { name: "Expand creature selector" }).click();
    await page.waitForTimeout(60);
    const expanded = { rect: await rect(page.locator(".wildz-creature-drawer")), className: await page.locator(".wildz-creature-drawer").getAttribute("class"), entries: await page.locator(".wildz-creature-choice").count() };
    await page.getByRole("button", { name: "Close creature selector" }).click();

    const audioSummary = page.locator('summary[aria-label="Wilds audio settings"]');
    await audioSummary.click();
    await page.waitForTimeout(50);
    const audio = { open: await page.locator(".wilds-audio-settings").getAttribute("open") !== null, rect: await rect(page.locator(".wilds-audio-settings")) };
    await audioSummary.click();

    await page.locator('[aria-label^="Open living Command Center"]').click();
    await page.waitForTimeout(80);
    const kaiDialog = page.locator('[role="dialog"]').last();
    const kai = { dialogCount: await page.locator('[role="dialog"]').count(), rect: await rect(kaiDialog), homesInert: await page.evaluate(() => [".wildz-reference-hud", ".wilds-map-status-home", ".wilds-left-instrument-home", ".wildz-world-controls"].map((selector) => ({ selector, inert: document.querySelector(selector)?.hasAttribute("inert") ?? false, ariaHidden: document.querySelector(selector)?.getAttribute("aria-hidden") ?? null }))) };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(60);

    await page.locator('[aria-label^="Open global live explorers"]').click();
    await page.waitForTimeout(70);
    const live = { rosterCount: await page.locator(".wilds-live-roster").count(), dialogCount: await page.locator('[role="dialog"]').count(), text: (await page.locator("body").textContent())?.includes("Live explorers") ?? false };
    await page.keyboard.press("Escape");
    matrix.push({ size, resting, preview, expanded, audio, kai, live, multiplayer: { liveBadgePresent: await page.locator('[aria-label^="Open global live explorers"]').count() === 1, remoteCount: Number((await page.locator('[aria-label^="Open global live explorers"]').textContent())?.trim() || 0) } });
  }

  await dismiss();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const interaction = {};
  const commandBox = await command.boundingBox();
  const dpad = page.getByRole("button", { name: /Movement trackpad/ });
  const dpadBox = await dpad.boundingBox();
  if (!commandBox || !dpadBox) throw new Error("interaction controls unavailable");
  const commandPoint = { x: commandBox.x + commandBox.width / 2, y: commandBox.y + commandBox.height / 2, id: 302, radiusX: 4, radiusY: 4, force: 1 };
  const dpadPoint = { x: dpadBox.x + dpadBox.width * .78, y: dpadBox.y + dpadBox.height * .22, id: 301, radiusX: 4, radiusY: 4, force: 1 };
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [dpadPoint, commandPoint] });
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...dpadPoint, x: dpadPoint.x + 8 }, commandPoint] });
  await page.waitForTimeout(130);
  interaction.twoTouchDuring = { dpadPressed: await dpad.getAttribute("aria-pressed"), companionMode: await page.locator(".wilds-companion-command-zone").getAttribute("class") };
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(80);
  interaction.twoTouchReleased = await dpad.getAttribute("aria-pressed");
  await reloadProof();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);

  const beforeCycle = await activeProof();
  await command.focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(100);
  const afterCycle = await activeProof();
  await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(100);
  const restoredCycle = await activeProof();
  interaction.horizontalCycle = { before: beforeCycle.commandName, after: afterCycle.commandName, restored: restoredCycle.commandName, ownedOnly: [expected.vault.name, expected.slate.name].includes(afterCycle.commandName) };

  await command.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(80);
  interaction.tapPower = { eventText: await page.locator(".wilds-event-toast").textContent().catch(() => null), commandStillMounted: await command.count() === 1 };
  await page.keyboard.press("Escape");
  const returnToWorld = page.getByRole("button", { name: "Return to world" });
  if (await returnToWorld.count()) await returnToWorld.first().click();
  await page.waitForTimeout(140);

  const origin = { x: commandBox.x + commandBox.width / 2, y: commandBox.y + commandBox.height / 2 };
  await command.dispatchEvent("pointerdown", { pointerId: 410, pointerType: "touch", isPrimary: true, clientX: origin.x, clientY: origin.y, buttons: 1 });
  await page.waitForTimeout(180);
  await page.locator(".wilds-companion-ability-wheel").waitFor({ state: "attached", timeout: 1200 }).catch(() => {});
  await command.dispatchEvent("pointermove", { pointerId: 410, pointerType: "touch", isPrimary: true, clientX: origin.x + 44, clientY: origin.y, buttons: 1 });
  await page.waitForTimeout(60);
  interaction.holdSlide = { wheelVisible: await page.locator(".wilds-companion-ability-wheel").count() === 1, selected: await page.locator(".wilds-companion-ability[aria-selected=\"true\"]").textContent().catch(() => null) };
  await command.dispatchEvent("pointerup", { pointerId: 410, pointerType: "touch", isPrimary: true, clientX: origin.x + 44, clientY: origin.y, buttons: 0 });
  await page.waitForTimeout(140);
  await command.dispatchEvent("pointerdown", { pointerId: 411, pointerType: "touch", isPrimary: true, clientX: origin.x, clientY: origin.y, buttons: 1 });
  await page.locator(".wilds-companion-ability-wheel").waitFor({ state: "attached", timeout: 1200 }).catch(() => {});
  await command.dispatchEvent("pointercancel", { pointerId: 411, pointerType: "touch", isPrimary: true, clientX: origin.x, clientY: origin.y, buttons: 0 });
  await page.waitForTimeout(140);
  interaction.pointerCancel = { wheelCount: await page.locator(".wilds-companion-ability-wheel").count(), mode: await page.locator(".wilds-companion-command-zone").getAttribute("class") };

  await dpad.dispatchEvent("pointerdown", { pointerId: 512, pointerType: "touch", isPrimary: true, clientX: dpadBox.x + dpadBox.width * .75, clientY: dpadBox.y + dpadBox.height * .25, buttons: 1 });
  await page.waitForTimeout(50);
  const lostBefore = await dpad.getAttribute("aria-pressed");
  await dpad.dispatchEvent("lostpointercapture", { pointerId: 512, pointerType: "touch", isPrimary: true });
  await page.waitForTimeout(80);
  interaction.lostCapture = { before: lostBefore, after: await dpad.getAttribute("aria-pressed") };
  await command.focus(); await page.keyboard.press("a"); await page.waitForTimeout(50);
  await page.locator(".wilds-companion-ability-wheel").waitFor({ state: "attached", timeout: 1200 }).catch(() => {});
  const keyboardWheel = await page.locator(".wilds-companion-ability-wheel").count();
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter"); await page.waitForTimeout(60);
  interaction.keyboard = { wheelOpened: keyboardWheel === 1, focusRestored: await command.evaluate((element) => element === document.activeElement) };

  await command.focus(); await page.keyboard.press("a");
  await page.locator(".wilds-companion-ability-wheel").waitFor({ state: "attached", timeout: 1200 }).catch(() => {});
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(150);
  interaction.resizeCancellation = { wheelCount: await page.locator(".wilds-companion-ability-wheel").count(), commandMode: await page.locator(".wilds-companion-command-zone").getAttribute("class") };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Escape");

  await command.focus(); await page.keyboard.press("ArrowUp"); await page.waitForTimeout(50); await page.keyboard.press("Escape");
  interaction.escape = { drawerClosed: (await page.locator(".wildz-creature-drawer").getAttribute("class"))?.includes("is-closed") ?? false };
  interaction.text200 = await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; const result = { fontSize: getComputedStyle(document.documentElement).fontSize, overflowX: document.documentElement.scrollWidth - innerWidth }; document.documentElement.style.fontSize = ""; return result; });
  await page.emulateMedia({ reducedMotion: "reduce" });
  interaction.reducedMotion = await page.evaluate(() => ({ matches: matchMedia("(prefers-reduced-motion: reduce)").matches, drawerTransition: getComputedStyle(document.querySelector(".wildz-creature-drawer")).transitionDuration }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.context().setOffline(true);
  interaction.offline = await page.evaluate(() => ({ online: navigator.onLine, canvasCount: document.querySelectorAll("canvas").length, commandCount: document.querySelectorAll(".wilds-companion-command").length }));
  await page.context().setOffline(false);
  await client.send("Page.setWebLifecycleState", { state: "frozen" });
  await client.send("Page.setWebLifecycleState", { state: "active" });
  await page.waitForTimeout(80);
  interaction.lifecycle = await page.evaluate(() => ({ visibilityState: document.visibilityState, canvasCount: document.querySelectorAll("canvas").length }));
  const audioSummary = page.locator('summary[aria-label="Wilds audio settings"]');
  await audioSummary.click();
  const mute = page.locator('.wilds-audio-mute input[type="checkbox"]');
  const muteBefore = await mute.isChecked(); await mute.click(); const muteAfter = await mute.isChecked(); await mute.click();
  interaction.audioToggle = { before: muteBefore, after: muteAfter, restored: await mute.isChecked() === muteBefore };
  await audioSummary.click();

  const hapticSafety = [];
  for (const [index, variant] of ["missing", "non-callable", "throwing"].entries()) {
    await page.evaluate((kind) => Object.defineProperty(navigator, "vibrate", { configurable: true, value: kind === "missing" ? undefined : kind === "non-callable" ? {} : () => { throw new Error("qa vibration failure"); } }), variant);
    await command.focus(); await page.keyboard.press("ArrowUp");
    const target = index % 2 === 0 ? expected.vault : expected.slate;
    await page.getByRole("button", { name: new RegExp(`^${target.name}, level`) }).click({ timeout: 3000 });
    await page.waitForTimeout(60);
    hapticSafety.push({ variant, selected: (await activeProof()).commandName, commandMounted: await command.count() === 1 });
  }
  await page.evaluate(() => { try { delete navigator.vibrate; } catch {} });
  await command.focus(); await page.keyboard.press("ArrowUp");
  await page.getByRole("button", { name: new RegExp(`^${expected.slate.name}, level`) }).click({ timeout: 3000 });
  await page.waitForTimeout(80);
  interaction.hapticSafety = hapticSafety;
  interaction.finalActive = await activeProof();

  await dismiss();
  const preBattleActive = await activeProof();
  await page.getByRole("button", { name: /Open mission details/ }).click();
  const mission = page.getByRole("dialog", { name: "Living Story" });
  await mission.waitFor({ state: "visible" });
  const battleTrainer = mission.getByRole("button", { name: "Battle Trainer", exact: true }).first();
  const battleLeader = { reached: false, via: ["Open mission details", "Battle Trainer"], activeAssetId: preBattleActive.activeAssetId, activeName: preBattleActive.commandName };
  if (await battleTrainer.count() && await battleTrainer.isEnabled()) {
    await battleTrainer.click();
    const challenge = page.locator(".wilds-trainer-challenge");
    await challenge.waitFor({ state: "visible" });
    const lead = challenge.locator('.wilds-trainer-roster article').first();
    const screenshotVisibleBefore = await challenge.isVisible();
    if (!screenshotVisibleBefore) throw new Error("Battle Trainer roster disappeared before visual proof");
    await challenge.screenshot({ path: "output/playwright/task5-battle-leader-neiatid-final.png" });
    const screenshotVisibleAfter = await challenge.isVisible();
    if (!screenshotVisibleAfter) throw new Error("Battle Trainer roster disappeared during visual proof");
    Object.assign(battleLeader, {
      reached: true,
      surface: "Selected battle roster",
      trainerName: await challenge.locator("h2").innerText(),
      rosterCount: await challenge.locator('.wilds-trainer-roster article').count(),
      leadName: await lead.locator("strong").innerText(),
      leadRole: await lead.locator("small").innerText(),
      leadPortraitTitle: await lead.locator("svg title").textContent().catch(() => null),
      visualProof: { locator: ".wilds-trainer-challenge", visibleBefore: screenshotVisibleBefore, visibleAfter: screenshotVisibleAfter, screenshot: "output/playwright/task5-battle-leader-neiatid-final.png" }
    });
    await page.getByRole("button", { name: "Close trainer challenge" }).click();
  } else {
    Object.assign(battleLeader, { reason: "The visible Living Story Battle Trainer control was unavailable for this profile; no state was injected." });
    await page.keyboard.press("Escape");
  }

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const errors = consoleEntries.filter((entry) => entry.type === "error");
  const warnings = consoleEntries.filter((entry) => entry.type === "warning");
  const result = {
    schema: "wildz.vault-roster-balanced-hud.browser.v1",
    capturedAt: new Date().toISOString(),
    baseUrl,
    buildId: "9sYHunZv9Fb2Jn8qLGnlF",
    productCommit: "cea7b57",
    userAgent,
    fixtureBoundary: "Selection-only replay begins with an existing legitimate two-card production IndexedDB profile containing Toiusap and Neiatid. This replay does not qualify either card's acquisition provenance. No storage injection or test-fixture route was used.",
    qualificationBoundary: {
      selectionProfileInventoryCount: 2,
      acquisitionReplayed: false,
      newMarker: { browserQualified: false, evidence: "Automated implementation tests only; not asserted by this browser replay." }
    },
    selection: { initialActive, vaultCards, vaultManifests, vaultSelected, vaultReloaded, slateEntries, slateButtonRect: neiatidBox, slateSelected, slateReloaded },
    matrix,
    interaction,
    battleLeader,
    browserHealth: { consoleErrors: errors, consoleWarnings: warnings, pageErrors, httpErrors: responses.filter((response) => response.status >= 400), failedRequests },
    screenshots: ["output/playwright/task5-card-vault-toiusap-final.png", "output/playwright/task5-slate-neiatid-final.png", "output/playwright/task5-battle-leader-neiatid-final.png", ...viewports.map((viewport) => `output/playwright/task5-resting-${viewport.width}x${viewport.height}.png`)]
  };
  const downloadPromise = page.waitForEvent("download");
  await page.evaluate((json) => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); link.download = "task5-browser-result.json"; link.click(); }, JSON.stringify(result, null, 2));
  const download = await downloadPromise;
  await download.saveAs("output/playwright/task5-browser-result.json");
  return { schema: result.schema, buildId: result.buildId, productCommit: result.productCommit, selection: result.selection, viewports: result.matrix.map((entry) => entry.size), interaction: result.interaction, browserHealth: result.browserHealth };
}
