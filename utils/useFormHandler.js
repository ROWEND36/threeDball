import { useMemo, useState } from "react";

export default function useFormHandler(defaults = {}, cb) {
  const [data, setData] = useState(defaults);
  const [error, setError] = useState(null);
  return useMemo(
    () => new FormHandler(data, setData, cb, error, setError),
    [data, cb, error]
  );
}

class FormHandler {
  constructor(data, setData, cb, error, setError) {
    this.setData = setData;
    this.error = error;
    this.setError = setError;
    this.cb = cb;
    this.data = {...data};
  }
  _update(data = {}) {
    this.data = { ...this.data, ...data };
    this.setData(this.data);
  }
  set(key, value) {
    if (!key) console.error(new Error("UNdefined key"));
    this.data[key] = value;
    this._update();
  }
  submit(id) {
    return {
      id,
      name: id,
      type: "submit",
      onClick: async () => {
        if (id) this.set(id, true);
      },
    };
  }

  textInput(id, type) {
    return {
      id,
      name: id,
      type,
      onChange: (e) => {
        this.set(id, e.target.value);
      },
      value: this.data[id] || "",
    };
  }
  radio(...args) {
    return this.textInput(...args, "radio");
  }
  checkbox(id) {
    return {
      id,
      name: id,
      type: "checkbox",
      onChange: (e) => {
        this.set(id, e.target.checked);
      },
      value: this.data[id] || false,
    };
  }
  form(id) {
    return {
      id,
      name: id,
      onSubmit: async (e) => {
        try {
          this.setError(null);
          await this.cb(this.data, e);
        } catch (e) {
          console.warn("Form error: ", e);
          this.setError(e);
        }
        return false;
      },
    };
  }
}
