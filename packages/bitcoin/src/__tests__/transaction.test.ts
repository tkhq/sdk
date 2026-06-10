import {
  largestUTXOValueFirst,
  selectInputUTXOs,
  smallestUTXOValueFirst,
} from "../transaction";

describe("selectInputUTXOs", () => {
  it("should throw an error if no inputs are provided", () => {
    expect(() => selectInputUTXOs([], 100)).toThrow(
      "No inputs provided for selectInputUTXOs",
    );
  });

  it("should throw an error if the total input value is less than the output value", () => {
    const inputs = [{ value: 50 }, { value: 30 }];
    expect(() => selectInputUTXOs(inputs, 100)).toThrow(
      "Insufficient input value for selectInputUTXOs. Need 20 more.",
    );
  });

  it("should select the inputs based on the order they come in", () => {
    const input50 = { value: 50 };
    const input30 = { value: 30 };
    const input20 = { value: 20 };

    expect(selectInputUTXOs([input50, input30, input20], 70)).toEqual([
      [input50, input30],
      10n,
      [input20],
    ]);

    expect(selectInputUTXOs([input50, input20, input30], 70)).toEqual([
      [input50, input20],
      0n,
      [input30],
    ]);

    expect(selectInputUTXOs([input20, input30, input50], 70)).toEqual([
      [input20, input30, input50],
      30n,
      [],
    ]);
  });
});

describe("smallestUTXOValueFirst", () => {
  it("should sort UTXOs in ascending order by value", () => {
    const input50 = { value: 50 };
    const input30 = { value: 30 };
    const input20 = { value: 20 };

    const inputs = [input50, input30, input20];
    const sortedInputs = [...inputs].sort(smallestUTXOValueFirst);

    expect(sortedInputs).toEqual([input20, input30, input50]);
  });
});

describe("largestUTXOValueFirst", () => {
  it("should sort UTXOs in descending order by value", () => {
    const input50 = { value: 50 };
    const input30 = { value: 30 };
    const input20 = { value: 20 };

    const inputs = [input20, input30, input50];
    const sortedInputs = [...inputs].sort(largestUTXOValueFirst);

    expect(sortedInputs).toEqual([input50, input30, input20]);
  });
});
