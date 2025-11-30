import * as utils from "./utils";
import { Description, Texture } from "./Description";

const zoomLevels = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10];

type Options = {
  zoomLevel: number;
};

type State = {
  description: Description;
  options: Options;
  scrollX: number;
  scrollY: number;
};

export class Preview {
  private description: Description;
  private options: Options;
  private zoom!: HTMLSelectElement;
  private nextRefreshQuery = 0;
  private preload: HTMLElement;
  private onScrollTimeout?: number;

  constructor(
    private toolbar: HTMLElement,
    private content: HTMLElement,
    private properties: HTMLElement,
    private updateState: any,
    private postMessage: any
  ) {
    this.description = {} as Description;
    this.options = {
      zoomLevel: 2,
    } as Options;

    this.preload = utils.appendElement(this.properties, "div", "preload");
    this.preload.style.width = "0px";
    this.preload.style.height = "0px";
    this.preload.style.overflow = "hidden";

    this.rebuildToolbar();

    this.content.addEventListener("scroll", () => {
      if (this.onScrollTimeout) window.clearTimeout(this.onScrollTimeout);
      this.onScrollTimeout = window.setTimeout(() => this.onStateChanged(), 500);
    });

    this.postMessage({ type: "initialized" });
  }

  public onMessage(message: any) {
    switch (message.type) {
      case "setDescription":
        this.description = message.description;
        this.rebuildView(true);
        return;
    }
  }

  private rebuildView(refreshTextures?: boolean) {
    if (refreshTextures)
      ++this.nextRefreshQuery;

    const outputsDiv = utils.createElement("div", "outputs");
    const refreshQuery = this.nextRefreshQuery;

    for (const sheet of this.description.sheets)
      for (const output of sheet.outputs) {
        const outputDiv = utils.appendElement(outputsDiv, "div", "output");

        const titleDiv = utils.appendElement(outputDiv, "div", "title");
        const textDiv = utils.appendElement(titleDiv, "div", "text");
        textDiv.innerText = output.filename;

        const texturesDiv = utils.appendElement(outputDiv, "div", "textures");
        for (const textureIndex of output.textureIndices) {
          const texture = this.description.textures[textureIndex];
          const textureDiv = utils.appendElement(texturesDiv, "div", "texture");
          const textureFrameDiv = utils.appendElement(textureDiv, "div", "frame");
          const textureImageDiv = utils.appendElement(textureFrameDiv, "div", "image");
          textureImageDiv.style.setProperty("--filename", `url('${texture.uri}?${refreshQuery}'`);
          textureImageDiv.style.setProperty("--width", texture.width + "px");
          textureImageDiv.style.setProperty("--height", texture.height + "px");
        }
      }

    // in order to prevent flickering, add to preload div first and switch after some time
    this.preload.appendChild(outputsDiv);
    setTimeout(() => {
      utils.replaceOrAppendChild(this.content, outputsDiv);
    }, 100);
  }

  public onStateChanged() {
    this.updateState({
      options: this.options,
      description: this.description,
      scrollX: this.content.scrollLeft,
      scrollY: this.content.scrollTop,
    } as State);
  }

  public restoreState(state: State) {
    this.description = state.description;
    this.options = state.options;
    this.applyZoom();
    this.rebuildToolbar();
    this.rebuildView();
    this.content.scrollTo(state.scrollX, state.scrollY);
  }

  private rebuildToolbar() {
    const itemsDiv = utils.createElement("div", "items");

    this.zoom = utils.appendSelect(itemsDiv, "zoom", "  Zoom:");
    for (const level of zoomLevels)
      utils.appendOption(this.zoom, level.toString(), Math.round(level * 100) + "%");
    utils.addChangeHandler(this.zoom, (value: string) => {
      this.options.zoomLevel = Number(value);
      this.applyZoom();
      this.onStateChanged();
    });
    this.applyZoom();

    utils.replaceOrAppendChild(this.toolbar, itemsDiv);
  }

  private applyZoom() {
    this.zoom.selectedIndex = zoomLevels.indexOf(this.options.zoomLevel);
    if (this.content.style.getPropertyValue("--zoom") != this.options.zoomLevel.toString()) {
      this.content.style.setProperty("--zoom", this.options.zoomLevel.toString());
    }
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
}
