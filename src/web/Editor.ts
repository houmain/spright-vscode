import { Config, Input as ConfigInput } from "./Config";
import { Description, Input, Rect } from "./Description";

const zoomLevels = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10];

function createElement(type: string, className: string) {
  const element = document.createElement(type);
  element.className = className;
  return element;
}

function appendElement(parent: HTMLElement, type: string, className: string) {
  return parent.appendChild(createElement(type, className));
}

function replaceOrAppendChild(parent: HTMLElement, child: HTMLElement) {
  const prevChild = parent.getElementsByClassName(child.className).item(0);
  if (prevChild)
    parent.replaceChild(child, prevChild);
  else
    parent.appendChild(child);
}

function appendRect(parent: HTMLElement, rect: Rect, className: string) {
  const rectDiv = appendElement(parent, "div", className);
  rectDiv.style.setProperty("--rect_x", rect.x + "px");
  rectDiv.style.setProperty("--rect_y", rect.y + "px");
  rectDiv.style.setProperty("--rect_w", rect.w + "px");
  rectDiv.style.setProperty("--rect_h", rect.h + "px");
  return rectDiv;
}

function appendSelect(parent: HTMLElement, className: string, text: string) {
  const label = appendElement(parent, "label", className) as HTMLLabelElement;
  label.textContent = text;
  const select = appendElement(parent, "select", className) as HTMLSelectElement;
  select.id = "select-" + className;
  label.htmlFor = select.id;
  return select;
}

function appendOption(select: HTMLSelectElement, value: string, text: string) {
  const option = appendElement(select, "option", "zoom") as HTMLOptionElement;
  option.value = value;
  option.text = text;
  return option;
}

function appendTextbox(parent: HTMLElement, className: string, text: string) {
  const label = appendElement(parent, "label", className) as HTMLLabelElement;
  label.textContent = text;
  const input = appendElement(parent, "input", className) as HTMLInputElement;
  input.id = "text-" + className;
  input.type = "text";
  label.htmlFor = input.id;
  return input;
}

function appendCheckbox(parent: HTMLElement, className: string, text: string) {
  const input = appendElement(parent, "input", className) as HTMLInputElement;
  input.id = "checkbox-" + className;
  input.type = "checkbox";
  const label = appendElement(parent, "label", className) as HTMLLabelElement;
  label.htmlFor = input.id;
  label.textContent = text;
  return input;
}

function addClickHandler(element: HTMLElement, func: () => void) {
  element.addEventListener("click", (ev: MouseEvent) => {
    func();
    ev.stopPropagation();
  });
}

function addInputHandler(element: HTMLElement, func: () => void) {
  element.addEventListener("input", (ev: Event) => {
    func();
    ev.stopPropagation();
  });
}

function addDoubleClickHandler(element: HTMLElement, func: () => void) {
  element.addEventListener("dblclick", (ev: MouseEvent) => {
    func();
    ev.stopPropagation();
  });
}

function addVisibilityHandler(element: HTMLElement, func: () => void) {
  new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.intersectionRatio > 0) {
        func();
        observer.disconnect();
      }
    });
  }).observe(element);
}

type Options = {
  zoomLevel: number;
  filter?: string;
  showId: boolean;
  showPivot: boolean;
  showTrimmedRect: boolean;
  showInputTitle: boolean;
};

type State = {
  config: string;
  description: Description;
  options: Options;
  scrollX: number;
  scrollY: number;
};

export class Editor {
  private config: Config;
  private description: Description;
  private options: Options;
  private applyZoom?: () => void;
  private filter!: HTMLInputElement;
  private zoom!: HTMLSelectElement;
  private cachedElements: Map<any, HTMLElement> = new Map();
  private cachedElementsNew: Map<any, HTMLElement> = new Map();
  private onFilterChangedTimeout?: number;
  private onScrollTimeout?: number;

  constructor(
    private toolbar: HTMLElement,
    private content: HTMLElement,
    private properties: HTMLElement,
    private updateState: any,
    private postMessage: any
  ) {
    this.config = new Config("");
    this.description = {} as Description;
    this.options = {
      showId: true,
      showInputTitle: true,
      zoomLevel: 2,
    } as Options;

    const html = this.content.parentElement!.parentElement!;
    addDoubleClickHandler(html, () => {
      this.postMessage({ type: "openDocument" });
    });
    this.rebuildToolbar();

    this.postMessage({ type: "initialized" });
  }

  updateZoomSelection() {
    this.zoom.selectedIndex = zoomLevels.indexOf(this.options.zoomLevel);
  }

  focusFilter() {
    this.filter.focus();
    this.filter.select();
  }

  changeZoom(direction: number) {
    let n = zoomLevels.indexOf(this.options.zoomLevel);
    if (n == -1) n = 2;
    if (n > 0 && direction == -1) --n;
    if (n < zoomLevels.length - 1 && direction == 1) ++n;
    this.options.zoomLevel = zoomLevels[n];
    if (this.applyZoom) this.applyZoom();
    this.updateZoomSelection();
    this.onStateChanged();
  }

  onMessage(message: any) {
    switch (message.type) {
      case "setConfig":
        this.setConfig(message.config, message.description);
        return;
    }
  }

  setConfig(config: string, description: any) {
    if (config === this.config.source)
      return;

    const begin = Date.now();
    try {
      this.config = new Config(config);
      this.description = description;
    } catch {
      return this.showError("Parsing configuration failed");
    }
    const duration = (Date.now() - begin) / 1000.0;
    console.log("Updating configuration took", duration, "seconds");

    this.rebuildView();
    this.onStateChanged();
  }

  private showError(message: string) {
    this.content.innerHTML = `<div class='error'>${message}</div>`;
  }

  onStateChanged() {
    this.updateState({
      config: this.config.source,
      description: this.description,
      options: this.options,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    } as State);
  }

  onScrolled() {
    if (this.onScrollTimeout) window.clearTimeout(this.onScrollTimeout);
    this.onScrollTimeout = window.setTimeout(() => this.onStateChanged(), 500);
  }

  onFilterChanged() {
    if (this.onFilterChangedTimeout) window.clearTimeout(this.onFilterChangedTimeout);
    this.onFilterChangedTimeout = window.setTimeout(() => {
      this.options.filter = (this.filter.value === "" ?
        undefined : this.filter.value.toLocaleLowerCase());
      this.onStateChanged();
      this.rebuildView();
    }, 500);
  }

  restoreState(state: State) {
    this.config = new Config(state.config);
    this.description = state.description;
    this.options = state.options;
    this.rebuildToolbar();
    this.rebuildView();
    window.scrollTo(state.scrollX, state.scrollY);
  }

  private refreshDescription() {
    this.postMessage({
      type: "refreshDescription",
      describeOnlyInput: !(
        this.options.showPivot || this.options.showTrimmedRect
      ),
    });
  }

  private cacheElement(key: any, element: HTMLElement) {
    this.cachedElementsNew.set(key, element);
  }

  private tryGetCachedElement(key: any) {
    const element = this.cachedElements.get(key);
    if (element) {
      this.cachedElements.delete(key);
      this.cacheElement(key, element);
    }
    return element;
  }

  private rebuildToolbar() {
    const itemsDiv = createElement("div", "items");

    const buildButton = appendElement(itemsDiv, "button", "build");
    buildButton.innerText = "build";
    addClickHandler(buildButton, () => {
      this.postMessage({
        type: "build",
      });
    });

    const completeButton = appendElement(itemsDiv, "button", "auto");
    completeButton.innerText = "auto";
    addClickHandler(completeButton, () => {
      this.postMessage({
        type: "autocomplete",
      });
    });

    this.zoom = appendSelect(itemsDiv, "zoom", "  Zoom:");
    for (const level of zoomLevels)
      appendOption(this.zoom, level.toString(), Math.round(level * 100) + "%");
    this.zoom.addEventListener("change", () => {
      this.options.zoomLevel = zoomLevels[this.zoom.selectedIndex];
      this.onStateChanged();
      if (this.applyZoom) this.applyZoom();
    });
    this.updateZoomSelection();

    const showLabel = appendElement(itemsDiv, "label", "show-label");
    showLabel.innerText = "  Show:";

    const showInputTitle = appendCheckbox(itemsDiv, "show-input", "input");
    showInputTitle.checked = this.options.showInputTitle;
    addClickHandler(showInputTitle, () => {
      this.options.showInputTitle = showInputTitle.checked;
      this.onStateChanged();
      this.rebuildView();
    });

    const showId = appendCheckbox(itemsDiv, "show-id", "id");
    showId.checked = this.options.showId;
    addClickHandler(showId, () => {
      this.options.showId = showId.checked;
      this.onStateChanged();
      this.rebuildView();
    });

    const showPivot = appendCheckbox(itemsDiv, "show-pivot", "pivot");
    showPivot.checked = this.options.showPivot;
    addClickHandler(showPivot, () => {
      this.options.showPivot = showPivot.checked;
      this.onStateChanged();
      this.refreshDescription();
    });

    const showTrimmedRect = appendCheckbox(itemsDiv, "show-trimmed-rect", "trimmed-rect");
    showTrimmedRect.checked = this.options.showTrimmedRect;
    addClickHandler(showTrimmedRect, () => {
      this.options.showTrimmedRect = showTrimmedRect.checked;
      this.onStateChanged();
      this.refreshDescription();
    });

    this.filter = appendTextbox(itemsDiv, "filter", "  Filter:");
    addInputHandler(this.filter, () => { this.onFilterChanged(); });
    this.filter.value = this.options.filter || "";

    replaceOrAppendChild(this.toolbar, itemsDiv);
  }

  private matchesFilter(value: string) {
    return (!this.options.filter || value.toLowerCase().includes(this.options.filter));
  }

  private showInputProperties(inputDiv: HTMLElement, input: Input, configInput: ConfigInput) {
    const properties = this.properties;

    const itemsDiv = appendElement(properties, "div", "items");
    const typeSelect = appendSelect(itemsDiv, "type", "Type: ");
    for (const type of ["sprite", "grid", "grid-cells", "atlas"])
      appendOption(typeSelect, type, type);
    replaceOrAppendChild(properties, itemsDiv);

    const width = itemsDiv.getBoundingClientRect().width;
    const bounds = inputDiv.getBoundingClientRect();
    const left = bounds.left + (bounds.left > width + 20 ? -width - 5 : bounds.width + 5);
    const top = bounds.top + 20;
    properties.style.visibility = "visible";
    properties.style.left = left + "px";
    properties.style.top = top + "px";
  }

  private rebuildView() {
    const begin = Date.now();
    const inputsDiv = createElement("div", "inputs");
    this.applyZoom = () => {
      inputsDiv.style.setProperty("--zoom", this.options.zoomLevel.toString());
    };
    this.applyZoom();

    let inputIndex = 0;
    for (const input of this.description.inputs) {
      const configInput = this.config.inputs[inputIndex++];

      if (configInput?.sprites.length == 0 && input.sourceSprites.length == 0)
        continue;

      if (!this.matchesFilter(input.filename))
        continue;

      const inputDiv = appendElement(inputsDiv, "div", "input");
      if (this.options.showInputTitle) {
        const titleDiv = appendElement(inputDiv, "div", "title");
        if (configInput) {
          addClickHandler(inputDiv, () => {
            this.showInputProperties(inputDiv, input, configInput);
          });
          addDoubleClickHandler(inputDiv, () => {
            this.postMessage({
              type: "selectLine",
              lineNo: configInput.lineNo,
              columnNo: this.config.getParameterColumn(configInput),
            });
          });

          const autoButton = appendElement(titleDiv, "button", "auto");
          autoButton.innerText = "auto";
          addClickHandler(autoButton, () => {
            this.postMessage({
              type: "autocomplete",
              pattern: input.filename,
            });
          });
        }
        const textDiv = appendElement(titleDiv, "div", "text");
        textDiv.innerText = input.filename;
      }
      else {
        inputDiv.title = input.filename;
      }

      if (input.sourceSprites.length > 0) {
        const sourcesDiv = this.createSourceDiv(input, configInput);
        inputDiv.appendChild(sourcesDiv);
      }
    }

    this.cachedElements = this.cachedElementsNew;
    this.cachedElementsNew = new Map();

    replaceOrAppendChild(this.content, inputsDiv);
    const duration = (Date.now() - begin) / 1000.0;
    console.log("Rebuilding view took", duration, "seconds");
  }

  private createSourceDiv(input: Input, configInput?: ConfigInput): HTMLElement {
    let spriteIndex = 0;
    const sourcesDiv = createElement("div", "sources");
    for (const sourceSprites of input.sourceSprites) {
      const source = this.description.sources[sourceSprites.sourceIndex];
      const sourceDiv = appendElement(sourcesDiv, "div", "source");
      const sourceFrameDiv = appendElement(sourceDiv, "div", "frame");

      let sourceImageDiv = this.tryGetCachedElement(source.filename);
      if (!sourceImageDiv) {
        sourceImageDiv = createElement("div", "image");
        this.cacheElement(source.filename, sourceImageDiv);
        addVisibilityHandler(sourceImageDiv, () => {
          sourceImageDiv!.style.setProperty("--filename", `url('${source.uri}'`);
        });
      }
      sourceFrameDiv.appendChild(sourceImageDiv);
      sourceImageDiv.style.setProperty("--width", source.width + "px");
      sourceImageDiv.style.setProperty("--height", source.height + "px");

      const spritesDiv = appendElement(sourceFrameDiv, "div", "sprites");
      for (const index of sourceSprites.spriteIndices) {
        const sprite = this.description.sprites[index];
        const configSprite = configInput?.sprites[spriteIndex++];

        if (this.options.showTrimmedRect && sprite.trimmedSourceRect) {
          appendRect(spritesDiv, sprite.trimmedSourceRect, "trimmed-rect");
        }

        const spriteDiv = appendRect(
          spritesDiv,
          sprite.sourceRect,
          "sprite"
        );
        spriteDiv.title = sprite.id;

        if (this.options.showPivot &&
          sprite.pivot &&
          sprite.trimmedSourceRect &&
          sprite.rect &&
          sprite.trimmedRect) {
          const rx = sprite.trimmedSourceRect.x +
            (sprite.rect.x - sprite.trimmedRect.x);
          const ry = sprite.trimmedSourceRect.y +
            (sprite.rect.y - sprite.trimmedRect.y);
          const pivotDiv = appendElement(spritesDiv, "div", "pivot");
          pivotDiv.style.setProperty("--x", rx + sprite.pivot.x + "px");
          pivotDiv.style.setProperty("--y", ry + sprite.pivot.y + "px");
        }
        if (this.options.showId) {
          const textDiv = appendElement(spriteDiv, "div", "text");
          textDiv.innerText = sprite.id;
        }

        if (configSprite)
          addDoubleClickHandler(spriteDiv, () => {
            this.postMessage({
              type: "selectLine",
              lineNo: configSprite.lineNo,
              columnNo: this.config.getParameterColumn(configSprite),
            });
          });
      }
    }
    return sourcesDiv;
  }
}
