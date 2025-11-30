
import * as utils from "./utils";
import { Config, Sheet as ConfigSheet, Input as ConfigInput, Sprite as ConfigSprite, Subject } from "./Config";
import { Description, Input, Sprite } from "./Description";

const zoomLevels = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10];

type Options = {
  sheetIndex: number;
  zoomLevel: number;
  filter?: string;
  showId: boolean;
  showRect: boolean;
  showPivot: boolean;
  showTrimmedRect: boolean;
  showInputFilename: boolean;
};

type State = {
  config: string;
  description: Description;
  options: Options;
  scrollX: number;
  scrollY: number;
};

function isSequenceFilename(filename: string) {
  return filename.indexOf('{') != -1;
}

export class Editor {
  private config: Config;
  private description: Description;
  private options: Options;
  private filter!: HTMLInputElement;
  private zoom!: HTMLSelectElement;
  private sheet!: HTMLSelectElement;
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
      showRect: true,
      showInputFilename: true,
      zoomLevel: 2,
    } as Options;

    const html = this.content.parentElement!.parentElement!;
    utils.addDoubleClickHandler(html, () => {
      this.hideProperties();
      this.postMessage({ type: "openDocument" });
    });
    this.rebuildToolbar();

    this.toolbar.addEventListener("click", (e: MouseEvent) => { this.hideProperties(); e.stopPropagation(); });
    this.toolbar.addEventListener("dblclick", (e: MouseEvent) => { e.stopPropagation(); });
    this.properties.addEventListener("click", (e: MouseEvent) => { e.stopPropagation(); });
    this.properties.addEventListener("dblclick", (e: MouseEvent) => { e.stopPropagation(); });
    this.properties.addEventListener("wheel", (e: WheelEvent) => { e.stopPropagation(); });

    utils.addClickHandler(this.content, (event: MouseEvent) => {
      this.hideProperties();
    });
    utils.addRightClickHandler(this.content, (event: MouseEvent) => {
      this.showProperties(event, "Sheet");
      this.rebuildSheetProperties();
    });

    this.postMessage({ type: "initialized" });
  }

  private applyZoom() {
    this.zoom.selectedIndex = zoomLevels.indexOf(this.options.zoomLevel);
    if (this.content.style.getPropertyValue("--zoom") != this.options.zoomLevel.toString()) {
      this.hideProperties();
      this.content.style.setProperty("--zoom", this.options.zoomLevel.toString());
    }
  }

  public focusFilter() {
    this.filter.focus();
    this.filter.select();
  }

  public changeZoom(direction: number) {
    let n = zoomLevels.indexOf(this.options.zoomLevel);
    if (n == -1) n = 2;
    if (n > 0 && direction == -1) --n;
    if (n < zoomLevels.length - 1 && direction == 1) ++n;
    this.options.zoomLevel = zoomLevels[n];
    this.applyZoom();
    this.onStateChanged();
  }

  public onMessage(message: any) {
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
    if (forceRefresh ? forceRefresh : true)
      this.config.source = "";

    return result;
  }

  public setConfig(config: string, description: any) {
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

    this.rebuildToolbar();
    this.rebuildView();
    this.onStateChanged();
  }

  private showError(message: string) {
    this.content.innerHTML = `<div class='error'>${message}</div>`;
  }

  public onStateChanged() {
    this.content.style.setProperty("--sprite-rect-color",
      this.options.showRect ? "red" : "transparent");

    this.updateState({
      config: this.config.source,
      description: this.description,
      options: this.options,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    } as State);
  }

  public onScrolled() {
    if (this.onScrollTimeout) window.clearTimeout(this.onScrollTimeout);
    this.onScrollTimeout = window.setTimeout(() => this.onStateChanged(), 500);
  }

  public onFilterChanged() {
    if (this.onFilterChangedTimeout) window.clearTimeout(this.onFilterChangedTimeout);
    this.onFilterChangedTimeout = window.setTimeout(() => {
      const value = this.filter.value.toLocaleLowerCase().trim();
      this.options.filter = (value === "" ? undefined : value);
      this.onStateChanged();
      this.rebuildView();
    }, 200);
  }

  public restoreState(state: State) {
    this.config = new Config(state.config);
    this.description = state.description;
    this.options = state.options;
    this.applyZoom();
    this.rebuildToolbar();
    this.rebuildView();
    window.scrollTo(state.scrollX, state.scrollY);
  }

  private refreshDescription(force?: boolean) {
    if (force)
      this.config.source = "";

    this.postMessage({
      type: "refreshDescription",
      sheetDescriptionNeeded: (
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

    const completeButton = utils.appendElement(itemsDiv, "button", "complete");
    completeButton.innerText = "complete";
    utils.addClickHandler(completeButton, () => {
      this.postMessage({
        type: "complete",
      });
    });

    this.sheet = utils.appendSelect(itemsDiv, "sheet", "  Sheet: ");
    for (let i = 0; i < this.config.sheets.length; ++i) {
      const sheet = this.config.sheets[i];
      const name = (sheet.lineNo < 0 ? "spright" : this.config.getSubjectParameter(sheet, 0));
      utils.appendOption(this.sheet, i.toString(), name, (i == this.options.sheetIndex));
    }
    utils.addChangeHandler(this.sheet, () => {
      this.options.sheetIndex = this.sheet.selectedIndex;
      this.onStateChanged();
    });

    this.filter = utils.appendTextbox(itemsDiv, "filter", "  Filter:");
    this.filter.type = "search";
    utils.addInputHandler(this.filter, () => { this.onFilterChanged(); });
    this.filter.value = this.options.filter || "";

    this.zoom = utils.appendSelect(itemsDiv, "zoom", "  Zoom:");
    for (const level of zoomLevels)
      utils.appendOption(this.zoom, level.toString(), Math.round(level * 100) + "%");
    utils.addChangeHandler(this.zoom, (value: string) => {
      this.options.zoomLevel = Number(value);
      this.applyZoom();
      this.onStateChanged();
    });
    this.applyZoom();

    const showDiv = utils.appendElement(itemsDiv, "div", "show");
    const showLabel = utils.appendElement(showDiv, "label", "show-label");
    showLabel.innerText = "  Show:";

    const showInputFilename = utils.appendCheckbox(showDiv, "show-filename", "filename");
    showInputFilename.checked = this.options.showInputFilename;
    utils.addClickHandler(showInputFilename, () => {
      this.options.showInputFilename = showInputFilename.checked;
      this.onStateChanged();
      this.rebuildView();
    });

    const showId = utils.appendCheckbox(showDiv, "show-id", "id");
    showId.checked = this.options.showId;
    utils.addClickHandler(showId, () => {
      this.options.showId = showId.checked;
      this.onStateChanged();
      this.rebuildView();
    });

    const showRect = utils.appendCheckbox(showDiv, "show-rect", "rect");
    showRect.checked = this.options.showRect;
    utils.addClickHandler(showRect, () => {
      this.options.showRect = showRect.checked;
      this.onStateChanged();
    });

    const showPivot = utils.appendCheckbox(showDiv, "show-pivot", "pivot");
    showPivot.checked = this.options.showPivot;
    utils.addClickHandler(showPivot, () => {
      this.options.showPivot = showPivot.checked;
      this.onStateChanged();
      this.refreshDescription(true);
    });

    const showTrimmedRect = utils.appendCheckbox(showDiv, "show-trimmed-rect", "trimmed-rect");
    showTrimmedRect.checked = this.options.showTrimmedRect;
    utils.addClickHandler(showTrimmedRect, () => {
      this.options.showTrimmedRect = showTrimmedRect.checked;
      this.onStateChanged();
      this.refreshDescription(true);
    });

    utils.replaceOrAppendChild(this.toolbar, itemsDiv);
  }

  private matchesFilter(value: string) {
    return (!this.options.filter || value.toLowerCase().includes(this.options.filter));
  }

  public hideProperties() {
    this.properties.style.visibility = "hidden";
  }

  private showProperties(event: MouseEvent, title: string) {
    const offX = 0;
    const offY = 2;
    const width = this.properties.getBoundingClientRect().width;
    const left = event.clientX + window.scrollX + (event.clientX + width + 100 > window.innerWidth ? -width - offX : offX);
    const top = event.clientY + window.scrollY + offY;
    this.properties.style.visibility = "visible";
    this.properties.style.left = left + "px";
    this.properties.style.top = top + "px";

    const titleLabel = utils.createElement("label", "title");
    titleLabel.textContent = title;
    utils.replaceOrAppendChild(this.properties, titleLabel);
  }

  private bindSubjectTextbox(editor: HTMLInputElement, subject: Subject) {
    editor.value = this.config.getSubjectParameter(subject, 0);
    utils.addInputHandler(editor, () => {
      this.config.setSubjectParameters(subject, [editor.value]);
      this.updateConfig();
    });
  }

  private bindNumberEditor(editor: utils.NumberEditor, subject: Subject, definition: string) {
    editor.setValue(this.config.getEffectivePropertyParameter(subject, definition, 0));
    utils.addInputHandler(editor.input, () => {
      if (!editor.input.value) {
        this.config.removeProperty(subject, definition);
      }
      else {
        this.config.setProperty(subject, definition, [editor.input.value]);
      }
      this.updateConfig();
    });
  }

  private bindCheckbox(checkbox: HTMLInputElement, subject: Subject, definition: string) {
    checkbox.checked = (this.config.hasEffectiveProperty(subject, definition) ?
      this.config.getEffectivePropertyParameter(subject, definition, 0) || "true" : "false") === "true";
    utils.addInputHandler(checkbox, () => {
      if (!checkbox.checked) {
        this.config.removeProperty(subject, definition);
      }
      else {
        this.config.setProperty(subject, definition, []);
      }
      this.updateConfig();
    });
  }

  private bindSelect(select: HTMLSelectElement, subject: Subject, definition: string) {
    select.value = this.config.getEffectivePropertyParameter(subject, definition, 0) || "";
    utils.addChangeHandler(select, () => {
      const value = select.item(select.selectedIndex)!.value;
      if (!value) {
        this.config.removeProperty(subject, definition);
      }
      else {
        this.config.setProperty(subject, definition, [value]);
      }
      this.updateConfig();
    });
  }

  private bindPairEditor(editor: utils.PairEditor, subject: Subject, definition: string, alwaysSetBoth?: boolean, dontRemoveEmpty?: boolean) {
    editor.setValue(this.config.getEffectivePropertyParameters(subject, definition)!);
    editor.addInputHandler((parameters) => {
      if (!dontRemoveEmpty && parameters[0] === "" && parameters[1] === "") {
        this.config.removeProperty(subject, definition);
      }
      else {
        if (parameters[0] === "")
          parameters[0] = editor.input1.placeholder;
        if (alwaysSetBoth && parameters[1] === "")
          parameters[1] = editor.input2.placeholder || editor.input1.placeholder || "0";
        this.config.setProperty(subject, definition, parameters);
      }
      this.updateConfig();
    });
  }

  private bindAlternatingPropertyEditor(editor: utils.PairEditor,
    subject: Subject, definitionA: string, definitionB: string) {
    const valueA = this.config.getEffectivePropertyParameters(subject, definitionA)?.at(0);
    const valueB = this.config.getEffectivePropertyParameters(subject, definitionB)?.at(0);
    editor.input1.value = (valueB || valueA || "");
    editor.input2.checked = (valueB !== undefined);
    editor.addInputHandler((parameters) => {
      const checked = editor.input2.checked;
      this.config.removeProperty(subject, checked ? definitionA : definitionB);
      if (parameters[0] === "") {
        this.config.removeProperty(subject, checked ? definitionB : definitionA);
      }
      else {
        this.config.setProperty(subject, checked ? definitionB : definitionA, [parameters[0]]);
      }
      this.updateConfig();
    });
  }

  private bindRectEditors(posEditor: utils.PairEditor, sizeEditor: utils.PairEditor, subject: Subject, definition: string) {
    const rect = this.config.getEffectivePropertyParameters(subject, definition) || ["0", "0", "1", "1"];
    posEditor.setValue([rect[0], rect[1]]);
    sizeEditor.setValue([rect[2], rect[3]]);
    const setRect = () => {
      this.config.setProperty(subject, definition, rect);
      this.updateConfig();
    };
    posEditor.addInputHandler((parameters) => {
      rect[0] = parameters[0] || "0";
      rect[1] = parameters[1] || "0";
      setRect();
    });
    sizeEditor.addInputHandler((parameters) => {
      rect[2] = parameters[0] || "1";
      rect[3] = parameters[1] || "1";
      setRect();
    });
  }

  private rebuildSheetProperties() {
    const itemsDiv = utils.createElement("div", "items");
    const configSheet = this.config.sheets[this.sheet.selectedIndex];

    const packSelect = utils.appendSelect(itemsDiv, "pack", "Pack");
    const types = [
      ["", ""],
      ["binpack", "Bin-Pack"],
      ["rows", "Rows"],
      ["columns", "Columns"],
      ["compact", "Compact"],
      ["origin", "Origin"],
      ["single", "Single"],
      ["layers", "Layers"],
      ["keep", "Keep"],
    ];
    for (const type of types)
      utils.appendOption(packSelect, type[0], type[1]);
    this.bindSelect(packSelect, configSheet, "pack");

    const duplicatesSelect = utils.appendSelect(itemsDiv, "duplicates", "Duplicates");
    const deplicatesModes = [
      ["", ""],
      ["keep", "Keep"],
      ["share", "Share"],
      ["drop", "Drop"],
    ];
    for (const dup of deplicatesModes)
      utils.appendOption(duplicatesSelect, dup[0], dup[1]);
    this.bindSelect(duplicatesSelect, configSheet, "duplicates");

    const padding = utils.appendPairEditor(itemsDiv, "padding", "Padding Inner", "Outer").setMin(0);
    this.bindPairEditor(padding, configSheet, "padding");

    const allowRotate = utils.appendCheckbox(itemsDiv, "allow-rotate", "Allow Rotate", true);
    this.bindCheckbox(allowRotate, configSheet, "allow-rotate");

    const width = utils.appendPairEditor(itemsDiv, "width", "Width", "At Max").setMin(1).setType2("checkbox");
    this.bindAlternatingPropertyEditor(width, configSheet, "width", "max-width");

    const height = utils.appendPairEditor(itemsDiv, "height", "Height", "At Max").setMin(1).setType2("checkbox");
    this.bindAlternatingPropertyEditor(height, configSheet, "height", "max-height");

    const divisibleWidth = utils.appendNumberEditor(itemsDiv, "divisible-width", "Divisible Width").setMin(1);
    this.bindNumberEditor(divisibleWidth, configSheet, "divisible-width");

    const powerOfTwo = utils.appendCheckbox(itemsDiv, "power-of-two", "Power Of Two", true);
    this.bindCheckbox(powerOfTwo, configSheet, "power-of-two");

    const square = utils.appendCheckbox(itemsDiv, "square", "Square", true);
    this.bindCheckbox(square, configSheet, "square");

    utils.replaceOrAppendChild(this.properties, itemsDiv);
  }

  private rebuildInputProperties(input: Input, configInput: ConfigInput) {
    const currentInputType = this.config.getInputType(configInput);
    const itemsDiv = utils.createElement("div", "items");
    const typeSelect = utils.appendSelect(itemsDiv, "type", "Type");
    const types = [
      ["sprite", "Single Sprite"],
      ["atlas", "Atlas"],
      ["grid", "Grid (Cell-Size)"],
      ["grid-cells", "Grid (Cell-Count)"],
    ];
    for (const type of types)
      utils.appendOption(typeSelect, type[0], type[1], currentInputType.startsWith(type[0]));

    let gridVertical: HTMLInputElement | undefined;
    if (currentInputType.startsWith("grid")) {
      gridVertical = utils.appendCheckbox(itemsDiv, "grid-vertical", "Vertical", true);
      gridVertical.checked = (currentInputType === "grid-vertical" || currentInputType == "grid-cells-vertical");
    }

    const replaceInputType = async (type: string) => {
      if (type.startsWith("grid") && gridVertical?.checked)
        type += '-vertical';
      this.config.replaceInputType(configInput, type);
      await this.updateConfig();
      this.rebuildInputProperties(input, configInput);
    };
    utils.addChangeHandler(typeSelect, replaceInputType);
    if (gridVertical)
      utils.addInputHandler(gridVertical, () => { replaceInputType(typeSelect.value); });

    if (currentInputType == "grid" || currentInputType == "grid-vertical") {
      const grid = utils.appendPointEditor(itemsDiv, currentInputType, "Cell-Size").setMin(1);
      this.bindPairEditor(grid, configInput, currentInputType, false, true);
    }
    else if (currentInputType === "grid-cells" || currentInputType === "grid-cells-vertical") {
      const grid = utils.appendPointEditor(itemsDiv, currentInputType, "Cell-Count").setMin(0);
      this.bindPairEditor(grid, configInput, currentInputType, true, true);
      grid.setPlaceholder([0, 0]);
    }

    if (currentInputType.startsWith("grid")) {
      const gridOffset = utils.appendPointEditor(itemsDiv, "grid-offset", "Grid-Offset").setMin(0);
      this.bindPairEditor(gridOffset, configInput, "grid-offset");
      gridOffset.setPlaceholder([0]);
      const gridSpacing = utils.appendPointEditor(itemsDiv, "grid-spacing", "Grid-Spacing").setMin(0);
      this.bindPairEditor(gridSpacing, configInput, "grid-spacing");
      gridSpacing.setPlaceholder([0]);
    }

    if (currentInputType !== "sprite") {
      const maxSprites = utils.appendNumberEditor(itemsDiv, "max-sprites", "Max. Sprites").setMin(0);
      this.bindNumberEditor(maxSprites, configInput, "max-sprites");
      maxSprites.setPlaceholder(1000);
    }

    if (currentInputType !== "sprite" || isSequenceFilename(input.filename)) {
      utils.appendElement(itemsDiv, "div", "dummy");
      const autoButton = utils.appendElement(itemsDiv, "button", "complete");
      autoButton.innerText = "complete";
      utils.addClickHandler(autoButton, () => {
        this.postMessage({
          type: "complete",
          pattern: input.filename,
        });
      });
    }
    utils.replaceOrAppendChild(this.properties, itemsDiv);
  }

  private rebuildSpriteProperties(sprite: Sprite, configSprite: ConfigSprite, configInput: ConfigInput) {
    const currentInputType = this.config.getInputType(configInput);
    const itemsDiv = utils.createElement("div", "items");

    const id = utils.appendTextbox(itemsDiv, "sprite-id", "ID");
    this.bindSubjectTextbox(id, configSprite);
    id.placeholder = sprite.id;

    if (currentInputType.startsWith("grid")) {
      const span = utils.appendPointEditor(itemsDiv, "sprite-span", "Cell-Span").setMin(1);
      this.bindPairEditor(span, configSprite, "span", true);
      span.setPlaceholder([1, 1]);
    }
    else if (currentInputType == "atlas") {
      const pos = utils.appendPointEditor(itemsDiv, "sprite-position", "Position").setMin(0);
      const size = utils.appendPointEditor(itemsDiv, "sprite-size", "Size").setMin(1);
      this.bindRectEditors(pos, size, configSprite, "rect");
    }
    const pivot = utils.appendPointEditor(itemsDiv, "sprite-pivot", "Pivot");
    this.bindPairEditor(pivot, configSprite, "pivot", true);
    pivot.setPlaceholder([sprite.pivot?.x, sprite.pivot?.y]);

    utils.replaceOrAppendChild(this.properties, itemsDiv);
    id.select();
  }

  private rebuildView() {
    const begin = Date.now();
    const inputsDiv = utils.createElement("div", "inputs");

    let inputIndex = 0;
    for (const input of this.description.inputs) {
      const configInput = this.config.inputs[inputIndex++];

      if (configInput?.sprites.length == 0 && input.sourceSprites.length == 0)
        continue;

      if (!this.matchesFilter(input.filename))
        continue;

      const inputDiv = utils.appendElement(inputsDiv, "div", "input");

      if (configInput)
        utils.addRightClickHandler(inputDiv, (event: MouseEvent) => {
          this.showProperties(event, "Input");
          this.rebuildInputProperties(input, configInput);
        });
      utils.addClickHandler(inputDiv, () => {
        this.hideProperties();
        this.postMessage({
          type: "selectLine",
          lineNo: configInput.lineNo,
          columnNo: this.config.getParameterColumn(configInput),
        });
      });

      if (this.options.showInputFilename) {
        const filenameDiv = utils.appendElement(inputDiv, "div", "filename");
        const textDiv = utils.appendElement(filenameDiv, "div", "text");
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

      if (!configInput)
        continue;

      const spritesDiv = utils.appendElement(sourceFrameDiv, "div", "sprites");
      for (const index of sourceSprites.spriteIndices) {
        const sprite = this.description.sprites[index];
        const configSprite = configInput?.sprites[spriteIndex++];

        if (this.options.showTrimmedRect && sprite.trimmedSourceRect) {
          utils.appendRect(spritesDiv, sprite.trimmedSourceRect, "trimmed-rect");
        }

        const spriteDiv = utils.appendRect(spritesDiv, sprite.sourceRect,
          configSprite ? "sprite" : "sprite deduced");
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

        if (configSprite) {
          utils.addRightClickHandler(spriteDiv, (event: MouseEvent) => {
            this.showProperties(event, "Sprite");
            this.rebuildSpriteProperties(sprite, configSprite, configInput);
          });
          utils.addClickHandler(spriteDiv, () => {
            this.hideProperties();
            this.postMessage({
              type: "selectLine",
              lineNo: configSprite.lineNo,
              columnNo: this.config.getParameterColumn(configSprite),
            });
          });
        }
      }
    }
    return sourcesDiv;
  }
}
