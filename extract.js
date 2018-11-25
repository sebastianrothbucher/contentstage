const fs = require('fs');
const childproc = require('child_process');
const mysql = require('mysql');

console.log("Exporting Page & Category content");
const connection = mysql.createConnection(require('./connection'));
let pageres = new Promise((resolve, rejectt) => connection.query(
        "select p.identifier as p_identifier, s.code as s_code, p.title as p_title, " + 
        "p.page_layout as p_page_layout, p.content_heading as p_content_heading, " + 
        "p.content as p_content, p.update_time as p_update_time, p.is_active as p_is_active " + 
        "from cms_page p join cms_page_store ps on p.page_id=ps.page_id " + 
        "join store s on ps.store_id=s.store_id " + 
        "order by p.identifier, s.code", (err, res) => { // seems we don't need URLs so far
    if (err) {
        reject(err);
    } else {
        resolve(res);
    }
}));
// TODO: same for categories

let serialized = {};
let success = false;
Promise.all([
    pageres.then(res => {
        res.forEach(r => r.p_update_time = (r.p_update_time ? r.p_update_time.getTime() : null)); // unix ts    
        serialized.pages = res;
    }),
    // TODO: same for categories
]).then(() => {
    // TODO: save 2 file in ./contents + invoke git (if -d .git)
    const serfile = './contents/shop_content.json';
    fs.writeFileSync(serfile, JSON.stringify(serialized, null, 4), 'utf-8');
    if (process.argv.filter(a => a == '--nogit').length == 0 && 
            fs.existsSync('./.git') && 
            fs.lstatSync('./.git').isDirectory()) {
        childproc.execSync('git add ' + serfile);
        childproc.execSync('git commit -m "Update shop content"');
    }
    console.log("Done");
    success = true;
}).catch(err => {
    console.error(err);
}).finally(() => {
    connection.end();
    if (!success) {
        process.exit(1);
    }
});
