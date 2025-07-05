import React from "react";

/* HEX CODES:
Primary Color Scheme
#00022b  <-- Lightest
#010e54
#0855b1
#4fa5d8
#daeaf7  <-- Darkest

Secondary Color Scheme
#0d0b33  <-- Lightest
#4c2f6f
#52489f
#c266a7
#e7c8e7   <-- Darkest


*/

const ColorScheme: React.FC = () => {
  return (
    <>
      <table>
        <tbody>
          <tr>
            <td colSpan={5} style={{ textAlign: "center" }}>
              Primary Color Scheme
            </td>
          </tr>
          <tr>
            {["#00022b", "#010e54", "#0855b1", "#4fa5d8", "#daeaf7"].map(
              (item) => {
                return <td style={{ backgroundColor: item }}>{item}</td>;
              }
            )}
          </tr>
        </tbody>
      </table>
      <table>
        <tbody>
          <tr>
            <td colSpan={5} style={{ textAlign: "center" }}>
              Secondary Color Scheme
            </td>
          </tr>
          <tr>
            {["#0d0b33", "#4c2f6f", "#52489f", "#c266a7", "#e7c8e7"].map(
              (item) => {
                return <td style={{ backgroundColor: item }}>{item}</td>;
              }
            )}
          </tr>
        </tbody>
      </table>
    </>
  );
};

export { ColorScheme };
