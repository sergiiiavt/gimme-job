import "./database-workbench.css";
import "./database-compact-editor.css";
import DatabaseCodeEnhancer from "./database-code-enhancer";
import DatabaseExampleAutoRun from "./database-example-auto-run";
import DatabasePlayground from "./database-playground";

export default function DatabasePlaygroundPage() {
  return (
    <>
      <DatabasePlayground/>
      <DatabaseCodeEnhancer/>
      <DatabaseExampleAutoRun/>
    </>
  );
}
