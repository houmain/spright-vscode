import { Rect } from "./Description";

export function stripQuotes(text: string) {
  if (text.length > 1 && (text[0] == '"' || text[0] == "'") && text[0] == text[text.length - 1])
    return text.substring(1, text.length - 1);
  return text;
}

export function conditionallyQuote(text: string) {
  for (const c of [' ', '"', "'"])
    if (text.indexOf(c) != -1) {
      if (text.indexOf('"') != -1)
        return `'${text}'`;
      return `"${text}"`;
    }
  return text;
}

export function createElement(type: string, className: string) {
  const element = document.createElement(type);
  element.className = className;
  return element;
}

export function appendElement(parent: HTMLElement, type: string, className: string) {
  return parent.appendChild(createElement(type, className));
}

export function replaceOrAppendChild(parent: HTMLElement, child: HTMLElement) {
  const prevChild = parent.getElementsByClassName(child.className).item(0);
  if (prevChild)
    parent.replaceChild(child, prevChild);

  else
    parent.appendChild(child);
}

export function appendRect(parent: HTMLElement, rect: Rect, className: string) {
  const rectDiv = appendElement(parent, "div", className);
  rectDiv.style.setProperty("--rect_x", rect.x + "px");
  rectDiv.style.setProperty("--rect_y", rect.y + "px");
  rectDiv.style.setProperty("--rect_w", rect.w + "px");
  rectDiv.style.setProperty("--rect_h", rect.h + "px");
  return rectDiv;
}

export class NumberEditor {
  constructor(public input: HTMLInputElement) { }

  setValue(value: any) {
    this.input.value = value?.toString();
    return this;
  }
  setPlaceholder(value: any) {
    if (value !== undefined)
      this.input.placeholder = value.toString();
  }
  setMin(min: any) {
    this.input.min = min?.toString();
    return this;
  }
  setMax(max: any) {
    this.input.max = max?.toString();
    return this;
  }
}

export class PointEditor {
  constructor(public inputX: HTMLInputElement, public inputY: HTMLInputElement) { }

  setValue(values: any[]) {
    this.inputX.value = values?.at(0)?.toString();
    this.inputY.value = values?.at(1)?.toString();
    return this;
  }
  setPlaceholder(values: any[]) {
    if (values?.at(0) !== undefined)
      this.inputX.placeholder = values.at(0).toString();
    if (values?.at(1) !== undefined)
      this.inputY.placeholder = values.at(1).toString();
  }
  setMin(min: any) {
    this.inputX.min = min?.toString();
    this.inputY.min = min?.toString();
    return this;
  }
  setMax(max: any) {
    this.inputX.max = max?.toString();
    this.inputY.max = max?.toString();
    return this;
  }
  addInputHandler(func: (value: string[]) => void) {
    const handler = () => { func([this.inputX.value, this.inputY.value]); };
    addInputHandler(this.inputX, handler);
    addInputHandler(this.inputY, handler);
  }
}

export function appendSelect(parent: HTMLElement, className: string, text: string) {
  const label = appendElement(parent, "label", className) as HTMLLabelElement;
  label.textContent = text;
  const select = appendElement(parent, "select", className) as HTMLSelectElement;
  select.id = "select-" + className;
  label.htmlFor = select.id;
  return select;
}

export function appendOption(select: HTMLSelectElement, value: string, text: string, selected?: boolean) {
  const option = appendElement(select, "option", "zoom") as HTMLOptionElement;
  option.value = value;
  option.text = text;
  if (selected) option.selected = selected;
  return option;
}

export function appendNumberEditor(parent: HTMLElement, className: string, text: string) {
  const label = appendElement(parent, "label", className) as HTMLLabelElement;
  label.textContent = text;
  const input = appendElement(parent, "input", className) as HTMLInputElement;
  input.id = "number-" + className;
  input.type = "number";
  label.htmlFor = input.id;
  return new NumberEditor(input);
}

export function appendPointEditor(parent: HTMLElement, className: string, text: string) {
  const label = appendElement(parent, "label", className) as HTMLLabelElement;
  label.textContent = text + " X";
  const input = appendElement(parent, "span", className);
  const inputX = appendNumberEditor(input, "point-x", "");
  const inputY = appendNumberEditor(input, "point-y", "Y");
  label.htmlFor = inputX.input.id;
  return new PointEditor(inputX.input, inputY.input);
}

export function appendTextbox(parent: HTMLElement, className: string, text: string) {
  const label = appendElement(parent, "label", className) as HTMLLabelElement;
  label.textContent = text;
  const input = appendElement(parent, "input", className) as HTMLInputElement;
  input.id = "text-" + className;
  input.type = "text";
  label.htmlFor = input.id;
  return input;
}

export function appendCheckbox(parent: HTMLElement, className: string, text: string, labelFirst?: boolean) {
  const input = createElement("input", className) as HTMLInputElement;
  input.id = "checkbox-" + className;
  input.type = "checkbox";
  const label = createElement("label", className) as HTMLLabelElement;
  label.htmlFor = input.id;
  label.textContent = text;
  if (labelFirst) { parent.appendChild(label); parent.appendChild(input); }
  else { parent.appendChild(input); parent.appendChild(label); }
  return input;
}

export function addClickHandler(element: HTMLElement, func: (event: MouseEvent) => void) {
  element.addEventListener("click", (ev: MouseEvent) => {
    func(ev);
    ev.stopPropagation();
  });
}

export function addDoubleClickHandler(element: HTMLElement, func: () => void) {
  element.addEventListener("dblclick", (ev: MouseEvent) => {
    func();
    ev.stopPropagation();
  });
}

export function addInputHandler(element: HTMLElement, func: () => void) {
  element.addEventListener("input", (ev: Event) => {
    func();
  });
}

export function addChangeHandler(select: HTMLSelectElement, func: (value: string) => void) {
  select.addEventListener("change", () => {
    if (select.selectedIndex >= 0)
      func(select.item(select.selectedIndex)!.value as string);
  });
}

export function addVisibilityHandler(element: HTMLElement, func: () => void) {
  new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.intersectionRatio > 0) {
        func();
        observer.disconnect();
      }
    });
  }).observe(element);
}
