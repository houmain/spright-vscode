import * as utils from "./utils";
import { Texture } from "./Description";

const zoomLevels = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10];

type Options = {
  zoomLevel: number;
};

type State = {
  options: Options;
  scrollX: number;
  scrollY: number;
};

export class Preview {
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
    this.options = {
      zoomLevel: 2,
    } as Options;

    this.preload = utils.appendElement(this.properties, "div", "preload");
    this.preload.style.width = "0px";
    this.preload.style.height = "0px";
    this.preload.style.overflow = "hidden";

    this.rebuildToolbar();

    this.postMessage({ type: "initialized" });
  }

  public onMessage(message: any) {
    switch (message.type) {
      case "setDescription":
        this.setDescription(message.textures);
        return;
    }
  }

  private setDescription(textures: Texture[]) {
    const texturesDiv = utils.createElement("div", "textures");
    const refreshQuery = this.nextRefreshQuery++;

    for (const texture of textures) {
      const textureDiv = utils.appendElement(texturesDiv, "div", "texture");
      const textureFrameDiv = utils.appendElement(textureDiv, "div", "frame");
      const textureImageDiv = utils.appendElement(textureFrameDiv, "div", "image");
      textureImageDiv.style.setProperty("--filename", `url('${texture.uri}?${refreshQuery}'`);
      textureImageDiv.style.setProperty("--width", texture.width + "px");
      textureImageDiv.style.setProperty("--height", texture.height + "px");
    }

    // in order to prevent flickering, add to preload div first and switch after some time
    this.preload.appendChild(texturesDiv);
    setTimeout(() => {
      utils.replaceOrAppendChild(this.content, texturesDiv);
    }, 100);
  }

  public onStateChanged() {
    this.updateState({
      options: this.options,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    } as State);
  }

  public restoreState(state: State) {
    this.options = state.options;
    this.applyZoom();
    this.rebuildToolbar();
    window.scrollTo(state.scrollX, state.scrollY);
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
      this.hideProperties();
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

  public hideProperties() {
  }

  public onScrolled() {
    if (this.onScrollTimeout) window.clearTimeout(this.onScrollTimeout);
    this.onScrollTimeout = window.setTimeout(() => this.onStateChanged(), 500);
  }
}
