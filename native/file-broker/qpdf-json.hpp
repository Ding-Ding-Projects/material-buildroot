#pragma once
#include <map>
#include <set>
#include <string>
#include <vector>
#include <stdexcept>
#include <utility>

// Bounded data reader for qpdf's JSON version 2 reports. Never executable input.
namespace qpdf_json {
inline void check(bool condition) { if (!condition) throw std::runtime_error("PDF_REPORT_UNAVAILABLE"); }
struct Value {
  enum Kind { object, array, string, number, other } kind = other;
  std::map<std::string, Value> fields;
  std::vector<Value> items;
  std::string scalar;
  const Value& at(const std::string& name) const {
    check(kind == object); auto found = fields.find(name); check(found != fields.end()); return found->second;
  }
};
inline std::string encode(const Value& value, unsigned depth = 0) {
  check(depth <= 64);
  if (value.kind == Value::object) {
    std::string result = "{"; bool first = true;
    for (const auto& field : value.fields) {
      if (!first) result += ","; first = false;
      Value name; name.kind = Value::string; name.scalar = field.first;
      result += encode(name, depth + 1) + ":" + encode(field.second, depth + 1);
      check(result.size() <= 1024 * 1024);
    }
    return result + "}";
  }
  if (value.kind == Value::array) {
    std::string result = "[";
    for (size_t index = 0; index < value.items.size(); ++index) { if (index) result += ","; result += encode(value.items[index], depth + 1); check(result.size() <= 1024 * 1024); }
    return result + "]";
  }
  if (value.kind != Value::string) return value.scalar;
  std::string result = "\""; const char* digits = "0123456789abcdef";
  for (unsigned char c : value.scalar) {
    if (c == '"' || c == '\\') { result += '\\'; result += static_cast<char>(c); }
    else if (c < 32) { result += "\\u00"; result += digits[c >> 4]; result += digits[c & 15]; }
    else result += static_cast<char>(c);
  }
  return result + "\"";
}
class Parser {
  const std::string& source;
  size_t offset = 0, nodes = 0;
  char peek() const { return offset < source.size() ? source[offset] : '\0'; }
  void whitespace() { while (peek() == ' ' || peek() == '\t' || peek() == '\n' || peek() == '\r') ++offset; }
  unsigned hex() {
    unsigned value = 0;
    for (unsigned i = 0; i < 4; ++i) {
      char c = peek(); ++offset; unsigned digit = 16;
      if (c >= '0' && c <= '9') digit = static_cast<unsigned>(c - '0');
      if (c >= 'a' && c <= 'f') digit = static_cast<unsigned>(c - 'a' + 10);
      if (c >= 'A' && c <= 'F') digit = static_cast<unsigned>(c - 'A' + 10);
      check(digit < 16); value = value * 16 + digit;
    }
    return value;
  }
  static void unicode(std::string& result, unsigned value) {
    check(value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff));
    if (value < 0x80) result += static_cast<char>(value);
    else if (value < 0x800) { result += static_cast<char>(0xc0 | (value >> 6)); result += static_cast<char>(0x80 | (value & 63)); }
    else if (value < 0x10000) { result += static_cast<char>(0xe0 | (value >> 12)); result += static_cast<char>(0x80 | ((value >> 6) & 63)); result += static_cast<char>(0x80 | (value & 63)); }
    else { result += static_cast<char>(0xf0 | (value >> 18)); result += static_cast<char>(0x80 | ((value >> 12) & 63)); result += static_cast<char>(0x80 | ((value >> 6) & 63)); result += static_cast<char>(0x80 | (value & 63)); }
  }
  std::string text() {
    check(peek() == '"'); ++offset; std::string result;
    while (peek() != '"') {
      unsigned char c = static_cast<unsigned char>(peek()); check(c >= 32); ++offset;
      if (c != '\\') { result += static_cast<char>(c); continue; }
      char escape = peek(); ++offset;
      if (escape == '"' || escape == '\\' || escape == '/') result += escape;
      else if (escape == 'b') result += '\b'; else if (escape == 'f') result += '\f';
      else if (escape == 'n') result += '\n'; else if (escape == 'r') result += '\r'; else if (escape == 't') result += '\t';
      else if (escape == 'u') {
        unsigned code = hex();
        if (code >= 0xd800 && code <= 0xdbff) {
          check(peek() == '\\'); ++offset; check(peek() == 'u'); ++offset;
          unsigned low = hex(); check(low >= 0xdc00 && low <= 0xdfff);
          code = 0x10000 + ((code - 0xd800) << 10) + low - 0xdc00;
        }
        unicode(result, code);
      } else check(false);
    }
    ++offset; return result;
  }
  Value value(unsigned depth) {
    check(depth <= 64 && ++nodes <= 20000); whitespace(); Value result;
    if (peek() == '{') {
      result.kind = Value::object; ++offset; whitespace(); if (peek() == '}') { ++offset; return result; }
      while (true) {
        whitespace(); std::string key = text(); whitespace(); check(peek() == ':'); ++offset;
        Value child = value(depth + 1); check(result.fields.emplace(key, std::move(child)).second); whitespace();
        if (peek() == '}') { ++offset; return result; } check(peek() == ','); ++offset;
      }
    }
    if (peek() == '[') {
      result.kind = Value::array; ++offset; whitespace(); if (peek() == ']') { ++offset; return result; }
      while (true) {
        result.items.push_back(value(depth + 1)); whitespace(); if (peek() == ']') { ++offset; return result; }
        check(peek() == ','); ++offset;
      }
    }
    if (peek() == '"') { result.kind = Value::string; result.scalar = text(); return result; }
    const size_t start = offset;
    if (peek() == '-' || (peek() >= '0' && peek() <= '9')) {
      result.kind = Value::number; if (peek() == '-') ++offset;
      if (peek() == '0') ++offset;
      else { check(peek() >= '1' && peek() <= '9'); while (peek() >= '0' && peek() <= '9') ++offset; }
      if (peek() == '.') { ++offset; check(peek() >= '0' && peek() <= '9'); while (peek() >= '0' && peek() <= '9') ++offset; }
      if (peek() == 'e' || peek() == 'E') { ++offset; if (peek() == '+' || peek() == '-') ++offset; check(peek() >= '0' && peek() <= '9'); while (peek() >= '0' && peek() <= '9') ++offset; }
    } else {
      while (peek() >= 'a' && peek() <= 'z') ++offset;
      const std::string literal = source.substr(start, offset - start); check(literal == "true" || literal == "false" || literal == "null");
    }
    check(offset - start <= 128); result.scalar = source.substr(start, offset - start); return result;
  }
public:
  explicit Parser(const std::string& text) : source(text) { check(source.size() <= 1024 * 1024); }
  Value parse() { Value result = value(0); whitespace(); check(offset == source.size()); return result; }
};
class Report {
  Value root;
  const Value& objects() const {
    const auto& qpdf = root.at("qpdf"); check(qpdf.kind == Value::array && qpdf.items.size() == 2);
    const auto& version = qpdf.items[0].at("jsonversion"); check(version.kind == Value::number && version.scalar == "2");
    check(qpdf.items[1].kind == Value::object); return qpdf.items[1];
  }
  const Value& reference(const Value& value) const {
    check(value.kind == Value::string && value.scalar.size() <= 64);
    return objects().at("obj:" + value.scalar).at("value");
  }
  int angle(const Value& initial) const {
    const Value* value = &initial;
    for (unsigned depth = 0; depth < 64; ++depth) {
      if (value->kind == Value::number) {
        const std::string& text = value->scalar;
        check(!text.empty() && text.size() <= 8 && text.find_first_not_of("-0123456789") == std::string::npos);
        size_t consumed = 0; int result = std::stoi(text, &consumed); check(consumed == text.size() && result % 90 == 0);
        return (result % 360 + 360) % 360;
      }
      value = &reference(*value);
    }
    check(false); return 0;
  }
public:
  explicit Report(const std::string& text) : root(Parser(text).parse()) { (void)objects(); }
  std::vector<int> rotations() const {
    const auto& pages = root.at("pages"); check(pages.kind == Value::array && !pages.items.empty() && pages.items.size() <= 10000);
    std::vector<int> result;
    for (const auto& page : pages.items) {
      const Value* dictionary = &reference(page.at("object")); std::set<const Value*> visited;
      int rotation = 0;
      while (true) {
        check(dictionary->kind == Value::object && visited.insert(dictionary).second && visited.size() <= 64);
        auto found = dictionary->fields.find("/Rotate");
        if (found != dictionary->fields.end()) { rotation = angle(found->second); break; }
        found = dictionary->fields.find("/Parent"); if (found == dictionary->fields.end()) break;
        dictionary = &reference(found->second);
      }
      result.push_back(rotation);
    }
    return result;
  }
  bool metadataAbsent() const {
    const auto& trailer = objects().at("trailer").at("value"); check(trailer.kind == Value::object);
    if (trailer.fields.count("/Info")) return false;
    const auto& catalog = reference(trailer.at("/Root")); check(catalog.kind == Value::object);
    return catalog.fields.count("/Metadata") == 0;
  }
  std::string withoutInfoUpdate() const {
    Value trailer = objects().at("trailer").at("value"); check(trailer.kind == Value::object);
    trailer.fields.erase("/Info");
    const Value& version = root.at("qpdf").items[0].at("pdfversion"); check(version.kind == Value::string);
    const std::string result = "{\"qpdf\":[{\"jsonversion\":2,\"pdfversion\":" + encode(version) + "},{\"trailer\":{\"value\":" + encode(trailer) + "}}]}";
    check(result.size() <= 1024 * 1024); return result;
  }
};
}
