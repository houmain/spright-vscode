
import * as utils from "./utils";
import { Config, Sheet as ConfigSheet, Input as ConfigInput, Sprite as ConfigSprite, Subject } from "./Config";
import { Description, Input, Sprite, Point, Rect } from "./Description";

const zoomLevels = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10];

enum EditorType {
  Input,
  Output,
}

type Options = {
  sheetIndex: number;
  zoomLevel: number;
  filter?: string;
  showId: boolean;
  showBounds: boolean;
  showPivot: boolean;
  showRect: boolean;
  showTrimmedRect: boolean;
  showFilename: boolean;
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
  private config = new Config("");
  private description = {} as Description;
  private options: Options;
  private filter!: HTMLInputElement;
  private zoom!: HTMLSelectElement;
  private sheet!: HTMLSelectElement;
  private cachedElements: Map<any, HTMLElement> = new Map();
  private cachedElementsNew: Map<any, HTMLElement> = new Map();
  private onFilterChangedTimeout?: number;
  private onScrollTimeout?: number;
  private nextRefreshQuery = 0;
  private preload: HTMLElement;

  constructor(
    private readonly editorType: EditorType,
    private toolbar: HTMLElement,
    private content: HTMLElement,
    private properties: HTMLElement,
    private updateState: any,
    private postMessage: any
  ) {

    this.options = {
      showId: true,
      showRect: true,
      showFilename: true,
      zoomLevel: 2,
    } as Options;

    this.preload = utils.appendElement(this.properties, "div", "preload");
    this.preload.style.width = "0px";
    this.preload.style.height = "0px";
    this.preload.style.overflow = "hidden";

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
      this.showProperties(event);
      this.rebuildSheetProperties();
    });
    this.content.addEventListener("scroll", () => {
      if (this.onScrollTimeout) window.clearTimeout(this.onScrollTimeout);
      this.onScrollTimeout = window.setTimeout(() => this.onStateChanged(), 500);
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
        break;
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
      scrollX: this.content.scrollLeft,
      scrollY: this.content.scrollTop,
    } as State);
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
    this.content.scrollTo(state.scrollX, state.scrollY);
  }

  private refreshDescription(force?: boolean) {
    if (force)
      this.config.source = "";

    this.postMessage({
      type: "refreshDescription",
      sheetDescriptionNeeded: (
        this.options.showPivot || this.options.showTrimmedRect || this.options.showBounds
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

    if (this.editorType == EditorType.Input) {
      const completeButton = utils.appendElement(itemsDiv, "button", "complete");
      completeButton.innerText = "complete";
      utils.addClickHandler(completeButton, () => {
        this.postMessage({
          type: "complete",
        });
      });
    }

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

    if (this.editorType == EditorType.Input) {
      this.filter = utils.appendTextbox(itemsDiv, "filter", "  Filter:");
      this.filter.type = "search";
      utils.addInputHandler(this.filter, () => { this.onFilterChanged(); });
      this.filter.value = this.options.filter || "";
    }

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

    const showFilename = utils.appendCheckbox(showDiv, "show-filename",
      (this.editorType == EditorType.Input ? "input-filename" : "output-filename"));
    showFilename.checked = this.options.showFilename;
    utils.addClickHandler(showFilename, () => {
      this.options.showFilename = showFilename.checked;
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

    const showRect = utils.appendCheckbox(showDiv, "show-rect",
      (this.editorType == EditorType.Input ? "source-rect" : "rect"));
    showRect.checked = this.options.showRect;
    utils.addClickHandler(showRect, () => {
      this.options.showRect = showRect.checked;
      this.onStateChanged();
    });

    if (this.editorType == EditorType.Output) {
      const showBounds = utils.appendCheckbox(showDiv, "show-bounds", "bounds");
      showBounds.checked = this.options.showBounds;
      utils.addClickHandler(showBounds, () => {
        this.options.showBounds = showBounds.checked;
        this.onStateChanged();
        this.refreshDescription(true);
      });
    }

    const showTrimmedRect = utils.appendCheckbox(showDiv, "show-trimmed-source-rect",
      (this.editorType == EditorType.Input ? "trimmed-source-rect" : "trimmed-rect"));
    showTrimmedRect.checked = this.options.showTrimmedRect;
    utils.addClickHandler(showTrimmedRect, () => {
      this.options.showTrimmedRect = showTrimmedRect.checked;
      this.onStateChanged();
      this.refreshDescription(true);
    });

    const showPivot = utils.appendCheckbox(showDiv, "show-pivot", "pivot");
    showPivot.checked = this.options.showPivot;
    utils.addClickHandler(showPivot, () => {
      this.options.showPivot = showPivot.checked;
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

  private showProperties(event: MouseEvent) {
    const offX = 0;
    const offY = 2;
    const width = this.properties.getBoundingClientRect().width;
    const left = event.clientX + window.scrollX + (event.clientX + width + 100 > window.innerWidth ? -width - offX : offX);
    const top = event.clientY + window.scrollY + offY;
    this.properties.style.visibility = "visible";
    this.properties.style.left = left + "px";
    this.properties.style.top = top + "px";
  }

  private bindTextbox(editor: HTMLInputElement, subject: Subject, definition: string) {
    editor.value = this.config.getEffectivePropertyParameter(subject, definition, 0) || "";
    utils.addInputHandler(editor, () => {
      if (!editor.value) {
        this.config.removeProperty(subject, definition);
      }
      else {
        this.config.setProperty(subject, definition, [editor.value]);
      }
      this.updateConfig();
    });
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
    if (this.config.hasProperty(subject, definition))
      checkbox.checked = (this.config.getPropertyParameter(subject, definition, 0) || "true") === "true";
    else if (this.config.hasCommonProperty(subject, definition))
      checkbox.indeterminate = (this.config.getCommonPropertyParameter(subject, definition, 0) || "true") === "true";
    checkbox.dataset["wasIndeterminate"] = checkbox.indeterminate.toString();

    utils.addInputHandler(checkbox, () => {
      const wasIndeterminate = Boolean(checkbox.dataset["wasIndeterminate"]);
      delete checkbox.dataset["wasIndeterminate"];
      if (wasIndeterminate && checkbox.checked)
        checkbox.checked = false;

      const check = checkbox.checked;
      const common = (this.config.hasCommonProperty(subject, definition) ?
        (this.config.getCommonPropertyParameter(subject, definition, 0) || "true") : "false") === "true";
      if ((!check && !common) || (check && common && !wasIndeterminate)) {
        this.config.removeProperty(subject, definition);
      }
      else {
        this.config.setProperty(subject, definition, check ? [] : ["false"]);
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

  private appendCommonSpriteProperties(itemsDiv: HTMLElement, configSubject: Subject) {
    const subjectType = this.config.getDefinition(configSubject);

    if (subjectType !== "sprite")
      utils.appendTitle(itemsDiv, "Sprites");

    if (subjectType !== "" && subjectType !== "sheet") {
      const sheetSelect = utils.appendSelect(itemsDiv, "sheet", "Sheet");
      for (const sheet of this.config.sheets) {
        const name = this.config.getSubjectParameter(sheet, 0);
        utils.appendOption(sheetSelect, name, name);
      }
      this.bindSelect(sheetSelect, configSubject, "sheet");
    }

    if (subjectType !== "sprite") {
      const id = utils.appendTextbox(itemsDiv, "sprite-id", "ID");
      this.bindTextbox(id, configSubject, "id");
    }

    const trim = utils.appendSelect(itemsDiv, "trim", "Trim");
    utils.appendOptions(trim, [
      ["", ""],
      ["none", "None"],
      ["rect", "Rect"],
      ["convex", "Convex"],
    ]);
    this.bindSelect(trim, configSubject, "trim");

    const trimThreshold = utils.appendNumberEditor(itemsDiv, "trim-threshold", "Trim-Threshold");
    this.bindNumberEditor(trimThreshold, configSubject, "trim-threshold");

    const crop = utils.appendCheckbox(itemsDiv, "crop", "Crop", true);
    this.bindCheckbox(crop, configSubject, "crop");

    const cropPivot = utils.appendCheckbox(itemsDiv, "crop-pivot", "Crop Pivot", true);
    this.bindCheckbox(cropPivot, configSubject, "crop-pivot");

    const extrude = utils.appendNumberEditor(itemsDiv, "extrude", "Extrude");
    this.bindNumberEditor(extrude, configSubject, "extrude");

    const minBounds = utils.appendPairEditor(itemsDiv, "min-size", "Min. Size X", "Y");
    this.bindPairEditor(minBounds, configSubject, "min-size");

    const divisibleBounds = utils.appendPairEditor(itemsDiv, "divisible-size", "Divisible Size X", "Y");
    this.bindPairEditor(divisibleBounds, configSubject, "divisible-size");

    const commonBounds = utils.appendTextbox(itemsDiv, "common-size", "Common Size Tag");
    this.bindTextbox(commonBounds, configSubject, "common-size");

    const align = utils.appendPairEditor(itemsDiv, "align", "Align X", "Y");
    this.bindPairEditor(align, configSubject, "align");

    const alignPivot = utils.appendTextbox(itemsDiv, "align-pivot", "Align Pivot Tag");
    this.bindTextbox(alignPivot, configSubject, "align-pivot");
  }

  private rebuildSheetProperties() {
    const itemsDiv = utils.createElement("div", "items");
    const configSheet = this.config.sheets[this.sheet.selectedIndex];

    utils.appendTitle(itemsDiv, "Sheet");

    const pack = utils.appendSelect(itemsDiv, "pack", "Pack");
    utils.appendOptions(pack, [
      ["", ""],
      ["binpack", "Bin-Pack"],
      ["rows", "Rows"],
      ["columns", "Columns"],
      ["compact", "Compact"],
      ["origin", "Origin"],
      ["single", "Single"],
      ["layers", "Layers"],
      ["keep", "Keep"],
    ]);
    this.bindSelect(pack, configSheet, "pack");

    const duplicates = utils.appendSelect(itemsDiv, "duplicates", "Duplicates");
    utils.appendOptions(duplicates, [
      ["", ""],
      ["keep", "Keep"],
      ["share", "Share"],
      ["drop", "Drop"],
    ]);
    this.bindSelect(duplicates, configSheet, "duplicates");

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

    this.appendCommonSpriteProperties(itemsDiv, this.config.defaultSheet);

    utils.replaceOrAppendChild(this.properties, itemsDiv);
  }

  private rebuildInputProperties(input: Input, configInput: ConfigInput) {
    const currentInputType = this.config.getInputType(configInput);
    const itemsDiv = utils.createElement("div", "items");

    utils.appendTitle(itemsDiv, "Input");

    const type = utils.appendSelect(itemsDiv, "type", "Type");
    utils.appendOptions(type, [
      ["sprite", "Single Sprite"],
      ["atlas", "Atlas"],
      ["grid", "Grid (Cell-Size)"],
      ["grid-cells", "Grid (Cell-Count)"],
    ], (key: string) => { return currentInputType.startsWith(key); });

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
    utils.addChangeHandler(type, replaceInputType);
    if (gridVertical)
      utils.addInputHandler(gridVertical, () => { replaceInputType(type.value); });

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

    this.appendCommonSpriteProperties(itemsDiv, configInput);

    utils.replaceOrAppendChild(this.properties, itemsDiv);
  }

  private rebuildSpriteProperties(sprite: Sprite, configSprite: ConfigSprite, configInput: ConfigInput) {
    const currentInputType = this.config.getInputType(configInput);
    const itemsDiv = utils.createElement("div", "items");

    utils.appendTitle(itemsDiv, "Sprite");

    const id = utils.appendTextbox(itemsDiv, "sprite-id", "ID");
    this.bindSubjectTextbox(id, configSprite);
    if (id.value.length == 0)
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

    this.appendCommonSpriteProperties(itemsDiv, configSprite);

    utils.replaceOrAppendChild(this.properties, itemsDiv);
    id.select();
  }

  private rebuildView() {
    if (this.editorType == EditorType.Input)
      this.rebuildInputView();
    else
      this.rebuildOutputView();
  }

  private rebuildInputView() {
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
          this.showProperties(event);
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

      if (this.options.showFilename) {
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

      if (this.description.sprites) {
        const spritesDiv = utils.appendElement(sourceFrameDiv, "div", "sprites");
        for (const index of sourceSprites.spriteIndices) {
          const sprite = this.description.sprites[index];
          this.createSprite(sprite, spritesDiv);
        }
      }
    }
    return sourcesDiv;
  }

  private rebuildOutputView() {
    const outputsDiv = utils.createElement("div", "outputs");
    const refreshQuery = this.nextRefreshQuery++;

    for (const sheet of this.description.sheets)
      for (const output of sheet.outputs) {
        const outputDiv = utils.appendElement(outputsDiv, "div", "output");

        const minSize: Point = { x: 0, y: 0 };
        const maxSize: Point = { x: 0, y: 0 };
        for (const textureIndex of output.textureIndices) {
          const texture = this.description.textures[textureIndex];
          if (!minSize.x || texture.width < minSize.x) minSize.x = texture.width;
          if (!minSize.y || texture.height < minSize.y) minSize.y = texture.height;
          if (texture.width > maxSize.x) maxSize.x = texture.width;
          if (texture.height > maxSize.y) maxSize.y = texture.height;
        }

        let sizeString = "";
        if (output.textureIndices.length > 1)
          sizeString += `${output.textureIndices.length} x `;
        sizeString += `${minSize.x}x${minSize.y}`;
        if (minSize.x != maxSize.x || minSize.y != maxSize.y)
          sizeString += ` - ${maxSize.x}x${maxSize.y}`;
        const title = `${output.filename} (${sizeString})`;

        if (this.options.showFilename) {
          const titleDiv = utils.appendElement(outputDiv, "div", "title");
          const textDiv = utils.appendElement(titleDiv, "div", "text");
          textDiv.innerText = title;
        }
        else {
          outputDiv.title = title;
        }

        const texturesDiv = utils.appendElement(outputDiv, "div", "textures");
        for (const textureIndex of output.textureIndices) {
          const texture = this.description.textures[textureIndex];
          const textureDiv = utils.appendElement(texturesDiv, "div", "texture");
          const textureFrameDiv = utils.appendElement(textureDiv, "div", "frame");
          const textureImageDiv = utils.appendElement(textureFrameDiv, "div", "image");
          textureImageDiv.style.setProperty("--filename", `url('${texture.uri}?${refreshQuery}'`);
          textureImageDiv.style.setProperty("--width", texture.width + "px");
          textureImageDiv.style.setProperty("--height", texture.height + "px");

          const spritesDiv = utils.appendElement(textureFrameDiv, "div", "sprites");
          for (const index of texture.spriteIndices) {
            const sprite = this.description.sprites[index];
            this.createSprite(sprite, spritesDiv);
          }
        }
      }

    // in order to prevent flickering, add to preload div first and switch after some time
    this.preload.appendChild(outputsDiv);
    setTimeout(() => {
      utils.replaceOrAppendChild(this.content, outputsDiv);
    }, 100);
  }

  private createSprite(sprite: Sprite, spritesDiv: HTMLElement) {
    const configInput = this.config.inputs[sprite.inputIndex];
    const configSprite = configInput?.sprites[sprite.inputSpriteIndex];

    const isInput = (this.editorType == EditorType.Input);
    const rect = (isInput ? sprite.sourceRect : sprite.rect)!;
    const trimmedRect = (isInput ? sprite.trimmedSourceRect : sprite.trimmedRect);

    if (this.options.showBounds) {
      const bounds: Rect = { ...rect };
      if (sprite.margin) {
        bounds.x -= sprite.margin.l;
        bounds.y -= sprite.margin.t;
        bounds.w += sprite.margin.l + sprite.margin.r;
        bounds.h += sprite.margin.t + sprite.margin.b;
      }
      utils.appendRect(spritesDiv, bounds, "bounds", sprite.rotated);
    }

    if (this.options.showTrimmedRect && trimmedRect)
      utils.appendRect(spritesDiv, trimmedRect, "trimmed-rect", !isInput && sprite.rotated);

    const spriteDiv = utils.appendRect(spritesDiv, rect,
      configSprite ? "sprite" : "sprite deduced", !isInput && sprite.rotated);
    spriteDiv.title = sprite.id;

    if (this.options.showPivot && sprite.pivot && rect) {
      let pivot: Point = { ...sprite.pivot };
      if (isInput) {
        pivot.x += (sprite.trimmedSourceRect!.x - sprite.sourceRect!.x);
        pivot.y += (sprite.trimmedSourceRect!.y - sprite.sourceRect!.y);
      }
      else if (sprite.rotated) {
        pivot = utils.rotateClockwise(pivot, rect.h);
      }
      const pivotDiv = utils.appendElement(spritesDiv, "div", "pivot");
      pivotDiv.style.setProperty("--x", (rect.x + pivot.x) + "px");
      pivotDiv.style.setProperty("--y", (rect.y + pivot.y) + "px");
    }

    if (this.options.showId) {
      const textDiv = utils.appendElement(spriteDiv, "div", "text");
      textDiv.innerText = sprite.id;
    }

    if (configSprite) {
      utils.addRightClickHandler(spriteDiv, (event: MouseEvent) => {
        this.showProperties(event);
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
