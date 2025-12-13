export type SourceSprites = {
  sourceIndex: number;
  spriteIndices: number[];
};

export type Input = {
  filename: string;
  sourceSprites: SourceSprites[];
};

export type Output = {
  filename: string;
  textureIndices: number[];
};

export type Source = {
  filename: string;
  path: string;
  width: number;
  height: number;
  uri: string;
};

export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Margin = {
  l: number;
  t: number;
  r: number;
  b: number;
};

export type Sprite = {
  index: number;
  id: string;
  inputIndex: number;
  inputSpriteIndex: number;
  sourceIndex: number;
  sourceRect: Rect;
  data: object;
  tags: object;

  sliceIndex?: number;
  sliceSpriteIndex?: number;
  rect?: Rect;
  pivot?: Point;
  margin?: Margin;
  rotated?: boolean;
  trimmedRect?: Rect;
  trimmedSourceRect?: Rect;
  vertices?: Point[];
};

export type Sheet = {
  slices: Slice[];
  outputs: Output[];
};

export type Slice = {
  spriteIndices: number[];
};

export type Texture = {
  sheetIndex: number;
  sliceIndex: number;
  spriteIndices: number[];
  filename: string;
  path: string;
  width: number;
  height: number;
  map: string;
  scale: number;
  uri: string;
};

export type Description = {
  inputs: Input[];
  sources: Source[];
  sheets: Sheet[];
  sprites: Sprite[];
  textures: Texture[];
};
