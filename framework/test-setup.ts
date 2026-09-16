// jsdom has no canvas implementation; simulations must cope with a missing 2D context.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
