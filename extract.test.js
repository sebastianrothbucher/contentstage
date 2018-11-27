jest.mock('fs');
jest.mock('child_process');
jest.mock('mysql');
jest.mock('./connection');
jest.mock('./serfile', () => 'serfile');

const unexpect = require('unexpected').clone(); // get more expect power for some spots

describe("extract", () => {

    const fs = require('fs');
    const childproc = require('child_process');
    const mysql = require('mysql');
    
    let mysqlConn;
    let processMock;

    beforeEach(() => {
        mysqlConn = {
            query: jest.fn(),
            end: jest.fn(),
        };
        mysql.createConnection.mockReturnValue(mysqlConn);
        processMock = {
            argv: [],
            exit: jest.fn(),
        }
    });
    afterEach(() => {
        jest.resetAllMocks();
    });

    it("runs extracting columns and transforming", () => {
        mysqlConn.query.mockImplementation((q, cb) => cb(null, [{p_content_heading: 'head of it all', p_content: 'hey\nho', p_update_time: new Date(42), }]));
        return (require('./extract')(processMock)).then(() => {
            expect(mysqlConn.query).toHaveBeenCalled();
            unexpect(mysqlConn.query.mock.calls[0][0], 'to match', /.*p_identifier.*s_code.*p_title.*p_page_layout.*p_content_heading.*p_content.*p_update_time.*from cms_page p join cms_page_store ps on p\.page_id=ps\.page_id.*/);
            expect(fs.writeFileSync).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/"pages":/), 'utf-8');
            unexpect(JSON.parse(fs.writeFileSync.mock.calls[0][1]), 'to satisfy', {pages: [{p_content_heading: 'head of it all', p_content: ['hey', 'ho'], p_update_time: 42, }]});
            expect(processMock.exit).not.toHaveBeenCalled();
            expect(mysqlConn.end).toHaveBeenCalled();
        });
    });
    it("commits to git if possible", () => {
        mysqlConn.query.mockImplementation((q, cb) => cb(null, []));
        fs.existsSync.mockReturnValue(true);
        fs.lstatSync.mockReturnValue({isDirectory: () => true});
        childproc.execSync.mockImplementation(cmd => cmd.match(/git status/) ? "serfile" : null);
        return (require('./extract')(processMock)).then(() => {
            expect(mysqlConn.query).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(childproc.execSync).toHaveBeenCalledWith(expect.stringMatching(/git status/));
            expect(childproc.execSync).toHaveBeenCalledWith(expect.stringMatching(/git add/));
            expect(childproc.execSync).toHaveBeenCalledWith(expect.stringMatching(/git commit -m "Update/));
            expect(processMock.exit).not.toHaveBeenCalled();
            expect(mysqlConn.end).toHaveBeenCalled();
        });
    });
    it("avoids git if specified", () => {
        mysqlConn.query.mockImplementation((q, cb) => cb(null, []));
        fs.existsSync.mockReturnValue(true);
        fs.lstatSync.mockReturnValue({isDirectory: () => true});
        childproc.execSync.mockImplementation(cmd => cmd.match(/git status/) ? "serfile" : null);
        processMock.argv = ['sth', '--nogit'];
        return (require('./extract')(processMock)).then(() => {
            expect(childproc.execSync).not.toHaveBeenCalledWith(expect.stringMatching(/git add/));
            expect(childproc.execSync).not.toHaveBeenCalledWith(expect.stringMatching(/git commit -m "Update/));
            expect(processMock.exit).not.toHaveBeenCalled();
        });
    });
    it("detects error in query", () => {
        mysqlConn.query.mockImplementation((q, cb) => cb("some err", []));
        fs.existsSync.mockReturnValue(true);
        fs.lstatSync.mockReturnValue({isDirectory: () => true});
        childproc.execSync.mockImplementation(cmd => cmd.match(/git status/) ? "serfile" : null);
        return (require('./extract')(processMock)).then(() => {
            expect(mysqlConn.query).toHaveBeenCalled();
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(childproc.execSync).not.toHaveBeenCalledWith(expect.stringMatching(/git add/));
            expect(childproc.execSync).not.toHaveBeenCalledWith(expect.stringMatching(/git commit -m "Update/));
            expect(processMock.exit).toHaveBeenCalledWith(1);
            expect(mysqlConn.end).toHaveBeenCalled();
        });
    });
    it("detects error in writing the file", () => {
        mysqlConn.query.mockImplementation((q, cb) => cb(null, []));
        fs.writeFileSync.mockImplementation(() => {throw "some err";});
        fs.existsSync.mockReturnValue(true);
        fs.lstatSync.mockReturnValue({isDirectory: () => true});
        childproc.execSync.mockImplementation(cmd => cmd.match(/git status/) ? "serfile" : null);
        return (require('./extract')(processMock)).then(() => {
            expect(mysqlConn.query).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(childproc.execSync).not.toHaveBeenCalledWith(expect.stringMatching(/git add/));
            expect(childproc.execSync).not.toHaveBeenCalledWith(expect.stringMatching(/git commit -m "Update/));
            expect(processMock.exit).toHaveBeenCalledWith(1);
            expect(mysqlConn.end).toHaveBeenCalled();
        });
    });

});