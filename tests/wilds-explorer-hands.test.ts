import assert from "node:assert/strict";
import { test } from "node:test";
import { projectWildsExplorerAnatomy } from "../src/features/play/wilds-explorer-anatomy";
import { createWildsExplorerHand } from "../src/features/play/wilds-explorer-hands";

test("explorer hands have four separate fingers, an opposing thumb and one draw surface", () => {
  const anatomy = projectWildsExplorerAnatomy("alder");
  for (const remote of [false, true]) {
    const geometry = createWildsExplorerHand(anatomy, "#b97856", 1, remote);
    const digits = geometry.userData.digits as { name: string; tip: number[]; base: number[] }[];
    assert.deepEqual(digits.map(digit => digit.name), ["index", "middle", "ring", "little", "thumb"]);
    assert.equal(new Set(digits.slice(0, 4).map(digit => digit.tip[0])).size, 4);
    assert.ok(digits[4].tip[0] < digits[0].tip[0], "thumb opposes the fingers toward the body");
    assert.ok(digits[1].tip[1] < digits[3].tip[1], "middle finger is longer than the little finger");
    assert.ok(digits.every(digit => digit.tip[2] > digit.base[2]), "digits curl naturally toward the palm");
    assert.equal(geometry.groups.length, 0, "skin and nails share one hand mesh");
    const count = geometry.getAttribute("position").count;
    assert.equal(geometry.getAttribute("color").count, count);
    for (const attribute of ["position", "normal", "color"]) {
      assert.ok([...geometry.getAttribute(attribute).array].every(Number.isFinite));
    }
    assert.ok(geometry.index!.count / 3 <= (remote ? 300 : 520));
    const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
    const nailTint = Array.from(geometry.getAttribute("color").array).slice(-3);
    let nails = 0;
    for (let i = 0; i < count; i++) {
      const color = geometry.getAttribute("color");
      if (color.getX(i) === nailTint[0] && color.getY(i) === nailTint[1] && color.getZ(i) === nailTint[2]) {
        assert.ok(normals.getZ(i) < 0, "dorsal nails must face outward rather than be backface-culled");
        nails++;
      }
    }
    assert.equal(nails, 30);
    // Every six-vertex plate narrows toward the fingertip; fixed-width distal
    // plates would extend past the tapered finger and look detached.
    const endWidth = Math.hypot(positions.getX(count-3)-positions.getX(count-1), positions.getY(count-3)-positions.getY(count-1));
    const startWidth = Math.hypot(positions.getX(count-6)-positions.getX(count-4), positions.getY(count-6)-positions.getY(count-4));
    assert.ok(endWidth < startWidth * .85);
    for (const digit of digits.slice(0,4)) {
      const nearTip: number[] = [];
      for (let i=0;i<count;i++) if (Math.abs(positions.getX(i)-digit.tip[0]) < .013
        && positions.getY(i)>digit.tip[1]+.002 && positions.getY(i)<digit.tip[1]+.0065) nearTip.push(positions.getX(i));
      assert.ok(nearTip.length>1 && Math.max(...nearTip)-Math.min(...nearTip)>.0085,
        "fingertips need rounded pads rather than long pointed cones");
    }
    geometry.dispose();
  }
});

test("paired hands are mirrored with outward winding and remote geometry stays smaller", () => {
  const anatomy = projectWildsExplorerAnatomy("alder");
  const right = createWildsExplorerHand(anatomy, "#b97856", 1);
  const left = createWildsExplorerHand(anatomy, "#b97856", -1);
  const remote = createWildsExplorerHand(anatomy, "#b97856", 1, true);
  const r = right.getAttribute("position"), l = left.getAttribute("position");
  assert.ok(remote.getAttribute("position").count < r.count);
  for (let i = 0; i < r.count; i++) {
    assert.equal(l.getX(i), -r.getX(i));
    assert.equal(l.getY(i), r.getY(i));
    assert.equal(l.getZ(i), r.getZ(i));
    assert.ok(Math.abs(left.getAttribute("normal").getX(i) + right.getAttribute("normal").getX(i)) < 1e-6);
  }
  for (let i = 0; i < right.index!.count; i += 3) {
    assert.equal(left.index!.getX(i), right.index!.getX(i));
    assert.equal(left.index!.getX(i + 1), right.index!.getX(i + 2));
  }
  for (const geometry of [right, left, remote]) geometry.dispose();
});

test("hand anatomy is stable for identity aliases and varies with the explorer", () => {
  const make = (identity: string) => createWildsExplorerHand(projectWildsExplorerAnatomy(identity), "#b97856", 1);
  const original = make("alder"), alias = make("@ALDER.receiz.id"), other = make("mira");
  assert.deepEqual(original.getAttribute("position").array, alias.getAttribute("position").array);
  assert.notDeepEqual(original.getAttribute("position").array, other.getAttribute("position").array);
  for (const geometry of [original, alias, other]) geometry.dispose();
});
