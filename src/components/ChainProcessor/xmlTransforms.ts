const HTML_VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

type ParsedMarkup = {
  document: Document;
  isHtml: boolean;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

const parseMarkup = (input: string): ParsedMarkup => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(input, "application/xml");
  if (xmlDoc.getElementsByTagName("parsererror").length === 0) {
    return { document: xmlDoc, isHtml: false };
  }
  return { document: parser.parseFromString(input, "text/html"), isHtml: true };
};

const getTagName = (element: Element, isHtml: boolean) =>
  isHtml ? element.tagName.toLowerCase() : element.tagName;

const appendAttributes = (element: Element) =>
  Array.from(element.attributes)
    .map((attr) => ` ${attr.name}="${attr.value}"`)
    .join("");

const hasElementChildren = (element: Element) =>
  Array.from(element.childNodes).some((child) => child.nodeType === Node.ELEMENT_NODE);

const formatTextNode = (node: Node) => node.textContent?.trim() || "";

const formatCommentNode = (node: Node, indent: string) => `\n${indent}<!--${node.textContent}-->`;

const formatElementNode = (
  element: Element,
  isHtml: boolean,
  level: number,
  formatNode: (node: Node, level?: number) => string,
) => {
  const indent = "  ".repeat(level);
  const tagName = getTagName(element, isHtml);
  const startTag = `\n${indent}<${tagName}${appendAttributes(element)}`;
  if (element.childNodes.length === 0) {
    return `${startTag}${isHtml && HTML_VOID_TAGS.has(tagName) ? ">" : "/>"}`;
  }
  const children = Array.from(element.childNodes)
    .map((child) => formatNode(child, level + 1))
    .join("");
  const closing = hasElementChildren(element) ? `\n${indent}</${tagName}>` : `</${tagName}>`;
  return `${startTag}>${children}${closing}`;
};

const serializeElementNode = (
  element: Element,
  isHtml: boolean,
  serializeNode: (node: Node) => string,
) => {
  const tagName = getTagName(element, isHtml);
  const startTag = `<${tagName}${appendAttributes(element)}`;
  if (element.childNodes.length === 0) {
    return `${startTag}${isHtml && HTML_VOID_TAGS.has(tagName) ? ">" : "/>"}`;
  }
  const children = Array.from(element.childNodes)
    .map((child) => serializeNode(child))
    .join("");
  return `${startTag}>${children}</${tagName}>`;
};

const formatMarkupNode = (node: Node, isHtml: boolean, level = 0): string => {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return formatElementNode(node as Element, isHtml, level, (child, nextLevel = level) =>
      formatMarkupNode(child, isHtml, nextLevel),
    );
  }
  if (node.nodeType === Node.TEXT_NODE) return formatTextNode(node);
  if (node.nodeType === Node.COMMENT_NODE) return formatCommentNode(node, "  ".repeat(level));
  return "";
};

const serializeMarkupNode = (node: Node, isHtml: boolean): string => {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return serializeElementNode(node as Element, isHtml, (child) =>
      serializeMarkupNode(child, isHtml),
    );
  }
  if (node.nodeType === Node.TEXT_NODE) return formatTextNode(node);
  return "";
};

const serializeDocumentChildren = (
  document: Document,
  selector: "head" | "body",
  formatter: (node: Node) => string,
) =>
  Array.from(document[selector]?.childNodes || [])
    .map((node) => formatter(node))
    .join("");

const getXmlDeclaration = (input: string, withNewline: boolean) => {
  const match = input.match(/^<\?xml.*?\?>/i);
  if (!match) return "";
  return withNewline ? `${match[0]}\n` : match[0];
};

const nodeToJsonValue = (node: Node): JsonValue => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.trim() || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as Element;
  const result: JsonObject = {};
  Array.from(element.attributes).forEach((attr) => {
    result[`@${attr.name}`] = attr.value;
  });

  Array.from(element.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childName = (child as Element).tagName;
      const childJson = nodeToJsonValue(child);
      if (!result[childName]) {
        result[childName] = childJson;
      } else if (Array.isArray(result[childName])) {
        result[childName].push(childJson);
      } else {
        result[childName] = [result[childName], childJson];
      }
      return;
    }

    const text = child.textContent?.trim();
    if (!text) return;
    if (Object.keys(result).length === 0 && element.childNodes.length === 1) {
      result["#text_only"] = text;
      return;
    }
    result["#text"] = text;
  });

  return result["#text_only"] ?? result;
};

const parseJsonToXmlOptions = (value: string) => {
  const defaults = { root: "root", noRoot: false, noHeader: false };
  try {
    if (value.startsWith("{")) return { ...defaults, ...JSON.parse(value) };
    if (value === "__none__") return { ...defaults, noRoot: true };
    if (value.trim()) return { ...defaults, root: value.trim() };
  } catch {}
  if (value === "__none__") return { ...defaults, noRoot: true };
  if (value.trim()) return { ...defaults, root: value.trim() };
  return defaults;
};

const renderJsonValue = (name: string, value: JsonValue, level = 0): string => {
  const indent = "  ".repeat(level);
  if (typeof value !== "object" || value === null) return `${indent}<${name}>${value}</${name}>`;
  if (Array.isArray(value))
    return value.map((item) => renderJsonValue(name, item, level)).join("\n");

  const attrs = Object.entries(value)
    .filter(([key]) => key.startsWith("@"))
    .map(([key, attrValue]) => ` ${key.slice(1)}="${attrValue}"`)
    .join("");
  const text = value["#text"] || "";
  const children = Object.entries(value)
    .filter(([key]) => !key.startsWith("@") && key !== "#text")
    .map(([key, childValue]) => `\n${renderJsonValue(key, childValue, level + 1)}`)
    .join("");
  if (!children && !text) return `${indent}<${name}${attrs}/>`;
  return `${indent}<${name}${attrs}>${text}${children}${children ? `\n${indent}` : ""}</${name}>`;
};

export const beautifyMarkup = (input: string) => {
  const parsed = parseMarkup(input);
  if (parsed.isHtml) {
    return `${serializeDocumentChildren(parsed.document, "head", (node) => formatMarkupNode(node, true))}${serializeDocumentChildren(parsed.document, "body", (node) => formatMarkupNode(node, true))}`.trim();
  }
  return `${getXmlDeclaration(input, true)}${formatMarkupNode(parsed.document.documentElement, false).trim()}`;
};

export const compressMarkup = (input: string) => {
  const parsed = parseMarkup(input);
  if (parsed.isHtml) {
    return `${serializeDocumentChildren(parsed.document, "head", (node) => serializeMarkupNode(node, true))}${serializeDocumentChildren(parsed.document, "body", (node) => serializeMarkupNode(node, true))}`;
  }
  return `${getXmlDeclaration(input, false)}${serializeMarkupNode(parsed.document.documentElement, false)}`;
};

export const xmlToJson = (input: string) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(input, "application/xml");
  if (xmlDoc.getElementsByTagName("parsererror").length > 0) throw new Error("无效的 XML 格式");
  if (!xmlDoc.documentElement) return "{}";
  return JSON.stringify(
    { [xmlDoc.documentElement.tagName]: nodeToJsonValue(xmlDoc.documentElement) },
    null,
    2,
  );
};

export const jsonToXml = (input: string, value: string) => {
  const source = JSON.parse(input) as JsonValue;
  const options = parseJsonToXmlOptions(value);
  const rootName = options.noRoot ? null : options.root.trim() || "root";
  const xmlHeader = options.noHeader ? "" : '<?xml version="1.0" encoding="UTF-8"?>\n';
  if (!rootName) {
    if (typeof source === "object" && source !== null && !Array.isArray(source)) {
      return `${xmlHeader}${Object.entries(source)
        .map(([key, child]) => renderJsonValue(key, child))
        .join("\n")
        .trim()}`;
    }
    return `${xmlHeader}${renderJsonValue("root", source).trim()}`;
  }
  return `${xmlHeader}${renderJsonValue(rootName, source).trim()}`;
};
