export type Input = {
  filename: string;
  sourceIndices: number[];
};

export type Source = {
  index: number;
  filename: string;
  path: string;
  width: number;
  height: number;
  spriteIndices: number[];
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
  id: string;
  index: number;
  inputSpriteIndex: number;
  pivot: Point;
  rect: Rect;
  trimmedRect: Rect;
  rotated: boolean;
  sourceIndex: number;
  sourceRect: Rect;
  trimmedSourceRect: Rect;
  sliceIndex: number;
  sliceSpriteIndex: number;
  data: object;
  tags: object;
  vertices: Point[];
};

export type Description = {
  inputs: Input[];
  sources: Source[];
  sprites: Sprite[];
};
