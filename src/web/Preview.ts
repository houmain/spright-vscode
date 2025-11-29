import * as utils from "./utils";
import { Texture } from "./Description";

type State = {
  scrollX: number;
  scrollY: number;
};

export class Preview {
  private nextRefreshQuery = 0;
  private preload: HTMLElement;

  constructor(
    private toolbar: HTMLElement,
    private content: HTMLElement,
    private properties: HTMLElement,
    private updateState: any,
    private postMessage: any
  ) {
    this.preload = utils.appendElement(this.properties, "div", "preload");
    this.preload.style.width = "0px";
    this.preload.style.height = "0px";
    this.preload.style.overflow = "hidden";
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

  public restoreState(state: State) {
    window.scrollTo(state.scrollX, state.scrollY);
  }

  public changeZoom(direction: number) {
  }

  public hideProperties() {
  }

  public onScrolled() {
  }
}
