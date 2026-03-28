import { JSONPath } from "jsonpath-plus";
import type { Step, StepType } from "./ChainTypes";
import { beautifyMarkup, compressMarkup, jsonToXml, xmlToJson } from "./xmlTransforms";

const BYLINE_STEP_TYPES = new Set<StepType>([
  "jsonpath",
  "xpath",
  "css",
  "base64-encode",
  "base64-decode",
  "url-encode",
  "url-decode",
  "regex-replace",
  "trim",
  "lowercase",
  "uppercase",
  "json-beautify",
  "json-compress",
  "xml-beautify",
  "xml-compress",
  "xml-to-json",
  "json-to-xml",
]);

const parseJsonInput = (current: string) => {
  if (!current.trim().startsWith("{") && !current.trim().startsWith("[")) return current;
  try {
    return JSON.parse(current);
  } catch {
    return current;
  }
};

const findJsonPathValue = (paths: string[], json: any) => {
  for (const path of paths) {
    const searchResult = JSONPath({ path, json, wrap: false });
    if (searchResult !== undefined && searchResult !== null) {
      if (!Array.isArray(searchResult) || searchResult.length > 0) return searchResult;
    }
  }
  return undefined;
};

const executeJsonPath = (value: string, current: string) => {
  const result = findJsonPathValue(
    value.split("||").map((path) => path.trim()),
    JSON.parse(current),
  );
  if (result === undefined) return "undefined";
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
};

const executeXPath = (value: string, current: string) => {
  const doc = new DOMParser().parseFromString(current, "text/html");
  const result = doc.evaluate(value, doc, null, XPathResult.ANY_TYPE, null);
  if (result.resultType === XPathResult.STRING_TYPE) return result.stringValue;
  if (result.resultType === XPathResult.NUMBER_TYPE) return result.numberValue.toString();
  if (result.resultType === XPathResult.BOOLEAN_TYPE) return result.booleanValue.toString();
  const nodes: Array<string | null> = [];
  let node = result.iterateNext();
  while (node) {
    nodes.push(node.textContent);
    node = result.iterateNext();
  }
  return nodes.join("\n");
};

const parseCssSelectorValue = (value: string) => {
  if (!value.trim()) return { attr: null, selector: "" };
  if (value.includes(" @")) {
    const parts = value.split(" @");
    return {
      attr: parts.pop()?.trim() || null,
      selector: parts.join(" @").trim(),
    };
  }
  if (value.includes("@") && !value.includes("[") && !value.includes("=")) {
    const lastAt = value.lastIndexOf("@");
    return {
      attr: value.substring(lastAt + 1).trim(),
      selector: value.substring(0, lastAt).trim(),
    };
  }
  return { attr: null, selector: value };
};

const extractCssElementValue = (elements: NodeListOf<Element>, attr: string | null) => {
  if (!attr)
    return Array.from(elements)
      .map((element) => element.textContent)
      .join("\n");
  if (attr.toLowerCase() === "outerhtml")
    return Array.from(elements)
      .map((element) => element.outerHTML)
      .join("\n");
  if (attr.toLowerCase() === "innerhtml")
    return Array.from(elements)
      .map((element) => element.innerHTML)
      .join("\n");
  return Array.from(elements)
    .map((element) => element.getAttribute(attr))
    .filter((item) => item !== null)
    .join("\n");
};

const executeCssSelector = (value: string, current: string) => {
  const { attr, selector } = parseCssSelectorValue(value);
  try {
    const doc = new DOMParser().parseFromString(current, "text/html");
    return extractCssElementValue(doc.querySelectorAll(selector || "*"), attr);
  } catch (error) {
    throw new Error(`CSS 选择器错误: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const executeJavaScript = (value: string, current: string) => {
  const inputData = current === "undefined" ? undefined : parseJsonInput(current);
  const fn = new Function("input", value);
  const result = fn(inputData);
  return typeof result === "object" && result !== null
    ? JSON.stringify(result, null, 2)
    : String(result);
};

const executeRegexReplace = (value: string, current: string) => {
  let options = { pattern: "", flags: "g", replacement: "" };
  try {
    if (value) options = { ...options, ...JSON.parse(value) };
  } catch {}
  if (!options.pattern) return current;
  try {
    const regex = new RegExp(options.pattern, options.flags);
    const replacement = options.replacement
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r");
    return current.replace(regex, replacement);
  } catch (error: any) {
    throw new Error(`正则错误: ${error.message}`);
  }
};

const jsonToCsv = (current: string) => {
  const parsed = JSON.parse(current);
  const data = Array.isArray(parsed) ? parsed : [parsed];
  if (data.length === 0) return "";
  const headers = Array.from(new Set(data.flatMap((row) => Object.keys(row))));
  return [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          const text = typeof value === "object" ? JSON.stringify(value) : String(value);
          return text.includes(",") || text.includes('"') || text.includes("\n")
            ? `"${text.replace(/"/g, '""')}"`
            : text;
        })
        .join(","),
    ),
  ].join("\n");
};

const parseCsvLine = (line: string) => {
  const result: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  result.push(cell.trim());
  return result;
};

const csvToJson = (current: string) => {
  const lines = current.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return "[]";
  const headers = parseCsvLine(lines[0]);
  const items = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const result: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) result[header] = values[index] ?? "";
    });
    return result;
  });
  return JSON.stringify(items, null, 2);
};

export const resolveStepByLine = (step: Step) => {
  if (!BYLINE_STEP_TYPES.has(step.type)) return false;
  if (step.byline) return true;
  if (!["base64-encode", "base64-decode", "regex-replace"].includes(step.type)) return false;
  try {
    return !!JSON.parse(step.value).byline;
  } catch {
    return false;
  }
};

const executeSimpleTransform = (type: StepType, current: string) => {
  switch (type) {
    case "base64-encode":
      return btoa(unescape(encodeURIComponent(current)));
    case "base64-decode":
      return decodeURIComponent(escape(atob(current)));
    case "url-encode":
      return encodeURIComponent(current);
    case "url-decode":
      return decodeURIComponent(current);
    case "trim":
      return current.trim();
    case "lowercase":
      return current.toLowerCase();
    case "uppercase":
      return current.toUpperCase();
    case "json-beautify":
      return JSON.stringify(JSON.parse(current), null, 2);
    case "json-compress":
      return JSON.stringify(JSON.parse(current));
    default:
      return current;
  }
};

export const executeStepLogic = (type: StepType, value: string, current: string): string => {
  switch (type) {
    case "jsonpath":
      return executeJsonPath(value, current);
    case "xpath":
      return executeXPath(value, current);
    case "css":
      return executeCssSelector(value, current);
    case "js":
      return executeJavaScript(value, current);
    case "regex-replace":
      return executeRegexReplace(value, current);
    case "xml-beautify":
      return beautifyMarkup(current);
    case "xml-compress":
      return compressMarkup(current);
    case "xml-to-json":
      return xmlToJson(current);
    case "json-to-xml":
      return jsonToXml(current, value);
    case "json-to-csv":
      return jsonToCsv(current);
    case "csv-to-json":
      return csvToJson(current);
    default:
      return executeSimpleTransform(type, current);
  }
};

const runStep = (step: Step, current: string) => {
  if (!resolveStepByLine(step)) return executeStepLogic(step.type, step.value, current);
  return current
    .split(/\r?\n/)
    .map((line, index) => {
      try {
        return executeStepLogic(step.type, step.value, line);
      } catch (error: any) {
        throw new Error(`第 ${index + 1} 行处理失败: ${error.message}`);
      }
    })
    .join("\n");
};

export const processChainSteps = (input: string, steps: Step[]) => {
  let current = input;
  for (const step of steps) {
    if (!step.active) continue;
    try {
      current = runStep(step, current);
    } catch (error: any) {
      throw { message: error.message, stepId: step.id };
    }
  }
  return current;
};
