import * as d3 from "d3";

function wrap(text: d3.Selection<any, any, any, any>, width: number) {
  text.each(function () {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line: string[] = [];
    const lineHeight = 1; // ems
    const x = text.attr("x");
    const y = text.attr("y");
    const dy = 0; //for the first line
    let tspan;

    if (words.length > 1) {
      tspan = text
        .text(null)
        .append("tspan")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", dy + "em");
      while ((word = words.pop())) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node()!.getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text
            .append("tspan")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", lineHeight + "em")
            .text(word);
        }
      }
    } else {
      // No wrapping for single-word labels
      text.text(text.text());
    }
  });
}

export default wrap;
