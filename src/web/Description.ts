export type InputSource = {
  index: number;
  spriteIndices: number[];
};

export type Input = {
  filename: string;
  sources: InputSource[];
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
  rotated?: boolean;
  trimmedRect?: Rect;
  trimmedSourceRect?: Rect;
  vertices?: Point[];
};

export type Slice = {
  spriteIndices: number[];
};

export type Texture = {
  sliceIndex: number;
  spriteIndices: number[];
  filename: string;
  width: number;
  height: number;
  map: string;
  scale: number;
};

export type Description = {
  inputs: Input[];
  sources: Source[];
  slices: Slice[];
  sprites: Sprite[];
  textures: Texture[];
};
