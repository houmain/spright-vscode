
import * as utils from "./utils";
import { Config, Input as ConfigInput, Sprite as ConfigSprite } from "./Config";
import { Description, Input, Sprite } from "./Description";

const zoomLevels = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10];

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
    utils.addDoubleClickHandler(html, () => {
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

  private async updateConfig(forceRefresh?: boolean) {
    this.config.updateSource();

    const result = this.postMessage({
      type: "updateConfig",
      config: this.config.source,
    });
    if (forceRefresh)
      this.config.source = "";

    return result;
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

  private refreshDescription(force?: boolean) {
    if (force)
      this.config.source = "";

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
    const itemsDiv = utils.createElement("div", "items");

    const buildButton = utils.appendElement(itemsDiv, "button", "build");
    buildButton.innerText = "build";
    utils.addClickHandler(buildButton, () => {
      this.postMessage({
        type: "build",
      });
    });

    const completeButton = utils.appendElement(itemsDiv, "button", "auto");
    completeButton.innerText = "auto";
    utils.addClickHandler(completeButton, () => {
      this.postMessage({
        type: "autocomplete",
      });
    });

    this.zoom = utils.appendSelect(itemsDiv, "zoom", "  Zoom:");
    for (const level of zoomLevels)
      utils.appendOption(this.zoom, level.toString(), Math.round(level * 100) + "%");
    utils.addChangeHandler(this.zoom, (value: string) => {
      this.options.zoomLevel = Number(value);
      this.onStateChanged();
      if (this.applyZoom) this.applyZoom();
    });
    this.updateZoomSelection();

    const showLabel = utils.appendElement(itemsDiv, "label", "show-label");
    showLabel.innerText = "  Show:";

    const showInputTitle = utils.appendCheckbox(itemsDiv, "show-input", "input");
    showInputTitle.checked = this.options.showInputTitle;
    utils.addClickHandler(showInputTitle, () => {
      this.options.showInputTitle = showInputTitle.checked;
      this.onStateChanged();
      this.rebuildView();
    });

    const showId = utils.appendCheckbox(itemsDiv, "show-id", "id");
    showId.checked = this.options.showId;
    utils.addClickHandler(showId, () => {
      this.options.showId = showId.checked;
      this.onStateChanged();
      this.rebuildView();
    });

    const showPivot = utils.appendCheckbox(itemsDiv, "show-pivot", "pivot");
    showPivot.checked = this.options.showPivot;
    utils.addClickHandler(showPivot, () => {
      this.options.showPivot = showPivot.checked;
      this.onStateChanged();
      this.refreshDescription(true);
    });

    const showTrimmedRect = utils.appendCheckbox(itemsDiv, "show-trimmed-rect", "trimmed-rect");
    showTrimmedRect.checked = this.options.showTrimmedRect;
    utils.addClickHandler(showTrimmedRect, () => {
      this.options.showTrimmedRect = showTrimmedRect.checked;
      this.onStateChanged();
      this.refreshDescription(true);
    });

    this.filter = utils.appendTextbox(itemsDiv, "filter", "  Filter:");
    this.filter.type = "search";
    this.filter.addEventListener("input", () => { this.onFilterChanged(); });
    this.filter.value = this.options.filter || "";

    utils.replaceOrAppendChild(this.toolbar, itemsDiv);
  }

  private matchesFilter(value: string) {
    return (!this.options.filter || value.toLowerCase().includes(this.options.filter));
  }

  private getInputType(configInput: ConfigInput) {
    const types = ["atlas", "grid", "grid-cells"];
    for (const type of types)
      if (this.config.getPropertyParameters(configInput, type) !== undefined)
        return type;
    for (const type of types)
      if (this.config.getCommonPropertyParameters(configInput, type) !== undefined)
        return type;
    return "sprite";
  }

  private async replaceInputType(configInput: ConfigInput, newType: string) {
    const type = this.getInputType(configInput);
    if (type == newType)
      return;

    if (newType !== "sprite" || configInput.sprites.length == 0) {
      let parameters = "";
      if (newType == "grid" || newType == "grid-cells")
        parameters = "16 16";
      this.config.setProperty(configInput, newType, parameters);
    }
    if (type !== "sprite" || configInput.sprites.length == 1)
      this.config.removeProperty(configInput, type);

    return this.updateConfig(true);
  }

  private async replaceSpriteId(configSprite: ConfigSprite, id: string) {
    this.config.setSubjectParameters(configSprite, id);
    return this.updateConfig(true);
  }

  public hideProperties() {
    this.properties.style.visibility = "hidden";
  }

  private showProperties(event: MouseEvent, title: string) {
    const offX = 20;
    const offY = 10;
    const width = this.properties.getBoundingClientRect().width;
    const left = event.clientX + window.scrollX + (event.clientX + width > window.innerWidth ? -width - offX : offX);
    const top = event.clientY + window.scrollY + offY;
    this.properties.style.visibility = "visible";
    this.properties.style.left = left + "px";
    this.properties.style.top = top + "px";

    const titleLabel = utils.createElement("label", "title");
    titleLabel.textContent = title;
    utils.replaceOrAppendChild(this.properties, titleLabel);
  }

  private rebuildInputProperties(input: Input, configInput: ConfigInput) {
    const currentInputType = this.getInputType(configInput);
    const itemsDiv = utils.createElement("div", "items");
    const typeSelect = utils.appendSelect(itemsDiv, "type", "Type");
    const types = [
      ["sprite", "Single Sprite"],
      ["atlas", "Atlas"],
      ["grid", "Grid (Cell-Size)"],
      ["grid-cells", "Grid (Cell-Count)"]
    ];
    for (const type of types)
      utils.appendOption(typeSelect, type[0], type[1], type[0] == currentInputType);

    utils.addChangeHandler(typeSelect, async (type: string) => {
      await this.replaceInputType(configInput, type);
      this.rebuildInputProperties(input, configInput);
    });

    if (currentInputType === "grid") {
      const gridSize = this.config.getPropertyParameters(configInput, "grid");
      utils.appendPointEditor(itemsDiv, "cell-size", "Cell-Size").setMin(1).setValue(gridSize, gridSize);
      utils.appendPointEditor(itemsDiv, "grid-offset", "Grid-Offset").setMin(0);
      utils.appendPointEditor(itemsDiv, "grid-spacing", "Grid-Spacing").setMin(0);
    }
    else if (currentInputType === "grid-cells") {
      utils.appendPointEditor(itemsDiv, "cell-count", "Cell-Count").setMin(1);
    }

    if (currentInputType !== "sprite") {
      utils.appendSpinbox(itemsDiv, "max-sprites", "Max. Sprites").setMin(0);
      utils.appendElement(itemsDiv, "div", "dummy");

      const autoButton = utils.appendElement(itemsDiv, "button", "auto");
      autoButton.innerText = "auto";
      utils.addClickHandler(autoButton, () => {
        this.postMessage({
          type: "autocomplete",
          pattern: input.filename,
        });
      });
    }
    utils.replaceOrAppendChild(this.properties, itemsDiv);
  }

  private rebuildSpriteProperties(sprite: Sprite, configSprite: ConfigSprite, configInput: ConfigInput) {
    const currentInputType = this.getInputType(configInput);
    const itemsDiv = utils.createElement("div", "items");

    const idInput = utils.appendTextbox(itemsDiv, "sprite-id", "ID");
    idInput.value = utils.stripQuotes(this.config.getSubjectParameters(configSprite));
    idInput.addEventListener("input", () => {
      this.replaceSpriteId(configSprite, utils.conditionallyQuote(idInput.value));
    });

    if (currentInputType == "grid") {
      utils.appendPointEditor(itemsDiv, "sprite-span", "Cell-Span").setMin(0);
    }
    else if (currentInputType == "atlas") {
      const x = sprite.sourceRect.x;
      const y = sprite.sourceRect.y;
      const w = sprite.sourceRect.w;
      const h = sprite.sourceRect.h;
      utils.appendPointEditor(itemsDiv, "sprite-position", "Position").setMin(0).setValue(x, y);
      utils.appendPointEditor(itemsDiv, "sprite-size", "Size").setMin(1).setValue(w, h);
    }
    const px = sprite.pivot?.x;
    const py = sprite.pivot?.y;
    utils.appendPointEditor(itemsDiv, "sprite-pivot", "Pivot").setValue(px, py);
    utils.replaceOrAppendChild(this.properties, itemsDiv);
  }

  private rebuildView() {
    const begin = Date.now();
    const inputsDiv = utils.createElement("div", "inputs");
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

      const inputDiv = utils.appendElement(inputsDiv, "div", "input");

      if (configInput)
        utils.addClickHandler(inputDiv, (event: MouseEvent) => {
          this.showProperties(event, "Input");
          this.rebuildInputProperties(input, configInput);
          this.postMessage({
            type: "selectLine",
            lineNo: configInput.lineNo,
            columnNo: this.config.getParameterColumn(configInput),
          });
        });

      if (this.options.showInputTitle) {
        const titleDiv = utils.appendElement(inputDiv, "div", "title");
        const textDiv = utils.appendElement(titleDiv, "div", "text");
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

    utils.replaceOrAppendChild(this.content, inputsDiv);
    const duration = (Date.now() - begin) / 1000.0;
    console.log("Rebuilding view took", duration, "seconds");
  }

  private createSourceDiv(input: Input, configInput?: ConfigInput): HTMLElement {
    let spriteIndex = 0;
    const sourcesDiv = utils.createElement("div", "sources");
    for (const sourceSprites of input.sourceSprites) {
      const source = this.description.sources[sourceSprites.sourceIndex];
      const sourceDiv = utils.appendElement(sourcesDiv, "div", "source");
      const sourceFrameDiv = utils.appendElement(sourceDiv, "div", "frame");

      let sourceImageDiv = this.tryGetCachedElement(source.filename);
      if (!sourceImageDiv) {
        sourceImageDiv = utils.createElement("div", "image");
        this.cacheElement(source.filename, sourceImageDiv!);
        utils.addVisibilityHandler(sourceImageDiv, () => {
          sourceImageDiv!.style.setProperty("--filename", `url('${source.uri}'`);
        });
      }
      sourceFrameDiv.appendChild(sourceImageDiv);
      sourceImageDiv!.style.setProperty("--width", source.width + "px");
      sourceImageDiv!.style.setProperty("--height", source.height + "px");

      const spritesDiv = utils.appendElement(sourceFrameDiv, "div", "sprites");
      for (const index of sourceSprites.spriteIndices) {
        const sprite = this.description.sprites[index];
        const configSprite = configInput?.sprites[spriteIndex++];

        if (this.options.showTrimmedRect && sprite.trimmedSourceRect) {
          utils.appendRect(spritesDiv, sprite.trimmedSourceRect, "trimmed-rect");
        }

        const spriteDiv = utils.appendRect(
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
          const pivotDiv = utils.appendElement(spritesDiv, "div", "pivot");
          pivotDiv.style.setProperty("--x", rx + sprite.pivot.x + "px");
          pivotDiv.style.setProperty("--y", ry + sprite.pivot.y + "px");
        }
        if (this.options.showId) {
          const textDiv = utils.appendElement(spriteDiv, "div", "text");
          textDiv.innerText = sprite.id;
        }

        if (configSprite)
          utils.addClickHandler(spriteDiv, (event: MouseEvent) => {
            this.showProperties(event, "Sprite");
            this.rebuildSpriteProperties(sprite, configSprite, configInput);
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
