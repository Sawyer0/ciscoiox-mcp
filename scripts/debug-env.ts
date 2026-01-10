import dotenv from "dotenv";
dotenv.config();

const keys = ["QUALI_TOKEN", "IOX_HOST", "LAB_ID"];
keys.forEach(k => {
    const val = process.env[k];
    console.log(`${k}: Type=${typeof val}, Length=${val ? val.length : 'N/A'}, Value=${val === "" ? "EMPTY STRING" : (val ? "SET" : "UNDEFINED")}`);
});