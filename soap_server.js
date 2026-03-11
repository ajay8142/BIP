const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");

const app = express();

const BIP_SOAP_URL =
"http://10.20.5.16:9502/xmlpserver/services/PublicReportService";

const USERNAME = "weblogic";
const PASSWORD = "weblogic123";

async function getReport(format) {

const soapBody = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">

<soapenv:Body>

<pub:runReport>

<pub:reportRequest>

<pub:attributeFormat>${format}</pub:attributeFormat>

<pub:reportAbsolutePath>/FCReports/Common Core/Report/smrsumry.xdo</pub:reportAbsolutePath>

</pub:reportRequest>

<pub:userID>${USERNAME}</pub:userID>
<pub:password>${PASSWORD}</pub:password>

</pub:runReport>

</soapenv:Body>

</soapenv:Envelope>
`;

console.log(soapBody);
const response = await axios.post(
BIP_SOAP_URL,
soapBody,
{
headers:{
"Content-Type":"text/xml;charset=UTF-8",
"SOAPAction":"runReport"
}
}
);

const parser = new xml2js.Parser({explicitArray:false});
const result = await parser.parseStringPromise(response.data);

const base64Report =
result["soapenv:Envelope"]
["soapenv:Body"]
["runReportResponse"]
["runReportReturn"]
["reportBytes"];

return Buffer.from(base64Report,"base64");

}

app.get("/report", async (req, res) => {

try {

const format = (req.query.format || "pdf").toLowerCase();
// const branch = req.query.branch || "777";

let previewBuffer;

// Preview logic
if (["xlsx","rtf"].includes(format)) {
previewBuffer = await getReport("pdf");
} else {
previewBuffer = await getReport(format);
}

const downloadBuffer = await getReport(format);

const base64Preview = previewBuffer.toString("base64");
const base64Download = downloadBuffer.toString("base64");

const contentTypes = {
pdf:"application/pdf",
xml:"application/xml",
csv:"text/csv",
xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
html:"text/html",
rtf:"application/rtf"
};

const contentType = contentTypes[format] || "application/octet-stream";

let previewContent = "";

if (["xml","csv","html"].includes(format)) {

previewContent = `
<pre style="background:#f4f4f4;padding:20px;height:600px;overflow:auto">
${previewBuffer.toString().replace(/</g,"&lt;").replace(/>/g,"&gt;")}
</pre>
`;

} else {

previewContent = `
<iframe 
src="data:application/pdf;base64,${base64Preview}"
width="100%"
height="600px">
</iframe>
`;
}

res.send(`
<html>

<body style="font-family:Arial">

<h2>Report Preview (${format.toUpperCase()})</h2>

<button onclick="downloadFile()">Download ${format.toUpperCase()}</button>

<br><br>

${previewContent}

<script>

function downloadFile(){

const link = document.createElement("a");

link.href="data:${contentType};base64,${base64Download}";
link.download="report.${format}";

link.click();

}

</script>

</body>

</html>
`);

} catch (error) {

console.log("ERROR:", error.message);

if (error.response) {
console.log(error.response.data);
}

res.status(500).send("Report generation failed");

}

});

app.listen(3000,()=>{
console.log("Server running on port 3000");
});