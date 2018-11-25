const fs = require('fs');
const childproc = require('child_process');
const mysql = require('mysql');
const serfile = require('./serfile');

if (process.argv.filter(a => a == '--nogit').length == 0 && 
            fs.existsSync('./.git') && 
            fs.lstatSync('./.git').isDirectory()) {
    if (childproc.execSync('git status -s').indexOf(serfile) >= 0) {
        console.error('content file is modified - pls. check in first');
        process.exit(2); // (not the 'normal' error)
    }
    childproc.execSync('node extract.js --nogit'); // don't check in
    childproc.execSync('git stash push ' + serfile); // but stash away
}

console.log("Applying Page & Category content");
const connection = mysql.createConnection(require('./connection'));
let beginres = new Promise((resolve, reject) => connection.query(
    'start transaction', 
    (err) => err ? reject(err) : resolve()));
let pageres = beginres.then(() => new Promise((resolve, reject) => connection.query(
        "select p.page_id as p_id, p.identifier as p_identifier, s.code as s_code, p.update_time as p_update_time " + 
        "from cms_page p join cms_page_store ps on p.page_id=ps.page_id " + 
        "join store s on ps.store_id=s.store_id", (err, res) => { // seems we don't need URLs so far
    if (err) {
        reject(err);
    } else {
        resolve(res);
    }
})));
// TODO: same for categories

const serialized = JSON.parse(fs.readFileSync(serfile, 'utf-8'));
const findPageIn = (r, arr) => arr.filter(sr => sr.p_identifier == r.p_identifier && sr.s_code == r.s_code)[0];
var success = false;
Promise.all([
    pageres.then(res => {
        // first off, check for all conflicts (newer date in DB now; we're in a transaction)
        let conflicts = res.filter(r => findPageIn(r, serialized.pages) && r.p_update_time.getTime() > findPageIn(r, serialized.pages).p_update_time);
        if (conflicts.length > 0) {
            console.error("Conflicts: newer contents in DB than in file for " + conflicts.map(r => r.p_identifier + '/' + r.s_code).join(', '));
            throw "conflicts";
        }
        // then, try to apply
        let pageproms = [];
        serialized.pages.forEach(pg => {
            if (findPageIn(pg, res)) { // update existing
                pageproms.push(new Promise((resolve, reject) => connection.query(
                    'update cms_page set page_layout=?, content_heading=?, content=?, update_time=?, is_active=? where page_id=?', 
                    [pg.p_page_layout, pg.p_content_heading, Array.isArray(pg.p_content) ? pg.p_content.join('\n') : pg.p_content, new Date(pg.p_update_time), pg.p_is_active, findPageIn(pg, res).p_id], 
                    (err, res) => {
                        if (err) {
                            reject(err);
                        } else { // number of rows updated
                            resolve(res);
                        }
                    })));
            } else {
                // TODO: insert those that do not exist
            }
        });
        return Promise.all(pageproms);
    }),
    // TODO: same for categories
]).then(() => new Promise((resolve, reject) => connection.query('commit', (err) => err ? reject(err): resolve()))).then(() => {
    console.log("Done");
    success = true;
}).catch(err => {
    console.error(err);
}).finally(() => {
    if (!success) {
        connection.query('rollback'); // don't care about result any more
    }
    connection.end();
    if (!success) {
        process.exit(1);
    }
});
