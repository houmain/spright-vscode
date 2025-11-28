import * as utils from "./utils";
import { Texture } from "./Description";

type State = {
  scrollX: number;
  scrollY: number;
};

export class Preview {

  constructor(
    private toolbar: HTMLElement,
    private content: HTMLElement,
    private properties: HTMLElement,
    private updateState: any,
    private postMessage: any
  ) {

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

    for (const texture of textures) {
      const textureDiv = utils.appendElement(texturesDiv, "div", "texture");
      const textureFrameDiv = utils.appendElement(textureDiv, "div", "frame");
      const textureImageDiv = utils.createElement("div", "image");
      textureImageDiv.style.setProperty("--filename", `url('${texture.uri}'`);
      textureImageDiv.style.setProperty("--width", texture.width + "px");
      textureImageDiv.style.setProperty("--height", texture.height + "px");
      textureFrameDiv.appendChild(textureImageDiv);
    }
    utils.replaceOrAppendChild(this.content, texturesDiv);
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
