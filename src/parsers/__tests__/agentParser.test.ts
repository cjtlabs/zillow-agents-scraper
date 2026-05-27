import { describe, it, expect } from "vitest";
import {
  parseName,
  parseReviews,
  parseSalesLast12Months,
  parseTotalTeamSales,
  parsePriceRange,
  parseAgentCardText,
} from "../agentParser.js";

describe("parseName", () => {
  it('splits "Tami Pardee" into first and last', () => {
    expect(parseName("Tami Pardee")).toEqual({
      firstName: "Tami",
      lastName: "Pardee",
    });
  });

  it("handles three-part names", () => {
    expect(parseName("Mary Jane Watson")).toEqual({
      firstName: "Mary",
      lastName: "Jane Watson",
    });
  });

  it("handles single name", () => {
    expect(parseName("Madonna")).toEqual({
      firstName: "Madonna",
      lastName: "",
    });
  });

  it("handles empty string", () => {
    expect(parseName("")).toEqual({ firstName: "", lastName: "" });
  });

  it("trims whitespace", () => {
    expect(parseName("  Tami  Pardee  ")).toEqual({
      firstName: "Tami",
      lastName: "Pardee",
    });
  });
});

describe("parseReviews", () => {
  it('parses "5.0 (1,639)"', () => {
    expect(parseReviews("5.0 (1,639)")).toEqual({
      zillowStars: 5.0,
      reviewCount: 1639,
    });
  });

  it('parses "4.8(230)"', () => {
    expect(parseReviews("4.8(230)")).toEqual({
      zillowStars: 4.8,
      reviewCount: 230,
    });
  });

  it('parses "3.5 (42)"', () => {
    expect(parseReviews("3.5 (42)")).toEqual({
      zillowStars: 3.5,
      reviewCount: 42,
    });
  });

  it("returns empty for no match", () => {
    expect(parseReviews("no reviews")).toEqual({});
  });
});

describe("parseSalesLast12Months", () => {
  it('parses "271 team sales last 12 months"', () => {
    expect(parseSalesLast12Months("271 team sales last 12 months")).toBe(271);
  });

  it('parses "1,500 sales last 12 months"', () => {
    expect(parseSalesLast12Months("1,500 sales last 12 months")).toBe(1500);
  });

  it("returns undefined for no match", () => {
    expect(parseSalesLast12Months("some other text")).toBeUndefined();
  });
});

describe("parseTotalTeamSales", () => {
  it('parses "2,279 team sales in Los Angeles"', () => {
    expect(
      parseTotalTeamSales("2,279 team sales in Los Angeles", "los-angeles-ca")
    ).toBe(2279);
  });

  it('parses "500 sales in Los Angeles"', () => {
    expect(
      parseTotalTeamSales("500 sales in Los Angeles", "los-angeles-ca")
    ).toBe(500);
  });

  it('parses "150 total team sales" as fallback', () => {
    expect(parseTotalTeamSales("150 total team sales", "los-angeles-ca")).toBe(
      150
    );
  });

  it("returns undefined for no match", () => {
    expect(
      parseTotalTeamSales("no sales info", "los-angeles-ca")
    ).toBeUndefined();
  });
});

describe("parsePriceRange", () => {
  it('parses "$10K - $18M"', () => {
    expect(parsePriceRange("$10K - $18M")).toEqual({
      minPrice: "$10K",
      maxPrice: "$18M",
    });
  });

  it('parses "$261K-$7.7M"', () => {
    expect(parsePriceRange("$261K-$7.7M")).toEqual({
      minPrice: "$261K",
      maxPrice: "$7.7M",
    });
  });

  it("returns empty for no match", () => {
    expect(parsePriceRange("no price info")).toEqual({});
  });
});

describe("parseAgentCardText", () => {
  it("parses with DOM-extracted name and brokerage", () => {
    const cardText =
      "TEAM5.0 (1,639)Tami PardeePardee Properties$10K - $18M team price range271 team sales last 12 months2,279 team sales in Los Angeles";

    const result = parseAgentCardText(
      cardText,
      "https://www.zillow.com/profile/tami-pardee",
      "los-angeles-ca",
      "Tami Pardee",
      "Pardee Properties"
    );

    expect(result.firstName).toBe("Tami");
    expect(result.lastName).toBe("Pardee");
    expect(result.fullName).toBe("Tami Pardee");
    expect(result.brokerage).toBe("Pardee Properties");
    expect(result.zillowStars).toBe(5.0);
    expect(result.reviewCount).toBe(1639);
    expect(result.salesLast12Months).toBe(271);
    expect(result.totalTeamSales).toBe(2279);
    expect(result.minPrice).toBe("$10K");
    expect(result.maxPrice).toBe("$18M");
    expect(result.city).toBe("los-angeles-ca");
    expect(result.profileUrl).toBe(
      "https://www.zillow.com/profile/tami-pardee"
    );
  });

  it("falls back to regex name extraction from concatenated text", () => {
    const cardText =
      "TEAM5.0 (880)Stephanie YoungerCOMPASS $261K - $7.7M team price range215 team sales last 12 months";

    const result = parseAgentCardText(
      cardText,
      "https://www.zillow.com/profile/stephanie-younger",
      "los-angeles-ca"
    );

    expect(result.firstName).toBe("Stephanie");
    expect(result.lastName).toBe("Younger");
    expect(result.zillowStars).toBe(5.0);
    expect(result.reviewCount).toBe(880);
    expect(result.salesLast12Months).toBe(215);
  });

  it("handles missing optional fields", () => {
    const cardText = "Some agent card text";
    const result = parseAgentCardText(
      cardText,
      "",
      "los-angeles-ca",
      "John Smith",
      "Some Brokerage"
    );

    expect(result.firstName).toBe("John");
    expect(result.lastName).toBe("Smith");
    expect(result.brokerage).toBe("Some Brokerage");
    expect(result.zillowStars).toBeUndefined();
    expect(result.reviewCount).toBeUndefined();
    expect(result.salesLast12Months).toBeUndefined();
    expect(result.profileUrl).toBeUndefined();
  });
});
