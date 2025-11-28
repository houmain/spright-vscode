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

export class PairEditor {
  constructor(public input1: HTMLInputElement, public input2: HTMLInputElement) { }

  setValue(values: any[]) {
    this.input1.value = values?.at(0)?.toString();
    this.input2.value = values?.at(1)?.toString();
    return this;
  }
  setPlaceholder(values: any[]) {
    if (values?.at(0) !== undefined)
      this.input1.placeholder = values.at(0).toString();
    if (values?.at(1) !== undefined)
      this.input2.placeholder = values.at(1).toString();
  }
  setMin(min: any) {
    this.input1.min = min?.toString();
    this.input2.min = min?.toString();
    return this;
  }
  setMax(max: any) {
    this.input1.max = max?.toString();
    this.input2.max = max?.toString();
    return this;
  }
  setType1(type: string) {
    this.input1.type = type;
    return this;
  }
  setType2(type: string) {
    this.input2.type = type;
    return this;
  }
  addInputHandler(func: (value: string[]) => void) {
    const handler = () => {
      if (this.input1.value === "" && this.input2.value !== "" && this.input2.type === "text")
        this.input1.value = this.input1.min;
      func([this.input1.value, this.input2.value]);
    };
    addInputHandler(this.input1, handler);
    addInputHandler(this.input2, handler);
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
  const option = appendElement(select, "option", "option") as HTMLOptionElement;
  option.value = value;
  option.text = text;
  if (selected) option.selected = true;
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

export function appendPairEditor(parent: HTMLElement, className: string, text1: string, text2: string) {
  const label = appendElement(parent, "label", className) as HTMLLabelElement;
  label.textContent = text1;
  const input = appendElement(parent, "span", className);
  const input1 = appendNumberEditor(input, "pair-1", "");
  const input2 = appendNumberEditor(input, "pair-2", text2);
  label.htmlFor = input1.input.id;
  return new PairEditor(input1.input, input2.input);
}

export function appendPointEditor(parent: HTMLElement, className: string, text: string) {
  return appendPairEditor(parent, className, text + " X", "Y");
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

export function addRightClickHandler(element: HTMLElement, func: (event: MouseEvent) => void) {
  element.addEventListener("contextmenu", (ev: MouseEvent) => {
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
