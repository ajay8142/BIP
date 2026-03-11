
const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const app = express();

const BIP_URL =
"http://10.20.5.16:9502/xmlpserver/services/rest/v1/reports/%7Eweblogic%2FVaishali%2FFCUBS%2FMAIN%2FReports%2Fsmrbasta.xdo/run";

const USERNAME = "weblogic";
const PASSWORD = "weblogic123";

async function getReport(format, branch) {

    const reportRequest = {
        byPassCache: true,
        attributeFormat: format,
        attributeLocale: "en-US",
        flattenXML: true,
        parameterNameValues: {
            listOfParamNameValues: [
                {
                    name: "PM_BRANCH",
                    values: [branch]
                }
            ]
        }
    };

    const form = new FormData();

    form.append("ReportRequest", JSON.stringify(reportRequest), {
        contentType: "application/json"
    });

    const response = await axios.post(
        BIP_URL,
        form,
        {
            auth: {
                username: USERNAME,
                password: PASSWORD
            },
            headers: {
                ...form.getHeaders()
            },
            responseType: "arraybuffer"
        }
    );

    return Buffer.from(response.data);
}

app.get("/report", async (req, res) => {

    try {

        const format = (req.query.format || "pdf").toLowerCase();
        const branch = req.query.branch || "777";

        let previewBuffer;

        // For Excel and RTF preview use PDF
        if (["xlsx", "rtf"].includes(format)) {
            previewBuffer = await getReport("pdf", branch);
        } else {
            previewBuffer = await getReport(format, branch);
        }

        const downloadBuffer = await getReport(format, branch);

        const base64Preview = previewBuffer.toString("base64");
        const base64Download = downloadBuffer.toString("base64");

        const contentTypes = {
            pdf: "application/pdf",
            xml: "application/xml",
            csv: "text/csv",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            html: "text/html",
            rtf: "application/rtf"
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
        res.status(500).send("Request failed");

    }

});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});