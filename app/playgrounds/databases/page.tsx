import "./database-workbench.css";
import DatabaseCodeEnhancer from "./database-code-enhancer";
import DatabasePlayground from "./database-playground";

export default function DatabasePlaygroundPage() {
  return (
    <>
      <DatabasePlayground/>
      <DatabaseCodeEnhancer/>
    </>
  );
}
