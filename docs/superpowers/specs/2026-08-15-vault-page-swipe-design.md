# Vault Page Swipe Design

## Goal

Restore book-like finger swiping between the existing Vault creature pages without changing the Vault's appearance, pagination, card selection, or scrolling behavior.

## Approved Behavior

- Compact Vault pages continue to show four creature cards.
- The existing previous button, next button, and page dots remain unchanged.
- When more than one page exists, a deliberate horizontal swipe across the four-card page moves exactly one page:
  - swipe left moves to the next page;
  - swipe right moves to the previous page.
- Swipes stop at the first and last pages, matching the existing button behavior.
- A tap still selects its creature and never becomes a page turn.
- Vertical finger movement continues to scroll the Vault sheet.
- No layout, artwork, animation, copy, page size, sorting, filtering, or creature-detail behavior changes.

## Implementation Boundary

Repair the existing pointer gesture in `WildsInventory` rather than replacing pagination. Read the pointer-up coordinates before releasing pointer capture so lost-capture cleanup cannot erase the completed gesture. Keep the current deliberate-swipe threshold and horizontal-intent check. Give the page surface `touch-action: pan-y` so the browser preserves vertical scrolling while allowing the horizontal gesture handler to receive book-like swipes.

## Failure and Edge Behavior

- Fewer than two pages: a horizontal gesture leaves the single page unchanged.
- First or last page: an outward swipe remains clamped to the current page.
- Diagonal or primarily vertical movement does not turn a page.
- Pointer cancellation or lost capture clears the gesture without selecting a card or changing pages.

## Verification

- Unit coverage proves left and right swipe direction, threshold rejection, vertical rejection, and page clamping.
- A rendered compact-Vault interaction confirms a left swipe moves from page 1 to page 2, a right swipe returns to page 1, and a normal tap still selects a creature.
- Existing pagination and full test suites remain green.
