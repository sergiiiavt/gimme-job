export async function load(url, context, nextLoad) {
  if (url.endsWith(".css")) {
    return {
      format: "module",
      shortCircuit: true,
      source: `
        const styles = new Proxy({}, {
          get(_target, key) { return typeof key === "string" ? key : ""; }
        });
        export default styles;
      `,
    };
  }
  return nextLoad(url, context);
}
