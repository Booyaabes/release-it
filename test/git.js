import test from 'tape';
import proxyquire from 'proxyquire';
import * as logMock from './mock/log';
import Config from '../lib/config';
import { readJSON } from './util/index';
import semver from 'semver';

const config = new Config();

const mocks = {
  './log': logMock,
  './config': {
    config
  }
};

const { run, pushd, popd, mkCleanDir } = proxyquire('../lib/shell', mocks);
const {
  isGitRepo,
  tagExists,
  getRemoteUrl,
  isWorkingDirClean,
  clone,
  stage,
  commit,
  tag,
  getLatestTag,
  push
} = proxyquire('../lib/git', mocks);

test('isGitRepo + tagExists + isWorkingDirClean +  hasChanges', async t => {
  const dir = 'test/resources';
  const tmp = `${dir}/tmp`;
  await mkCleanDir(tmp);
  await pushd(tmp);
  const actual_notIsGitRepo = await isGitRepo();
  t.notOk(actual_notIsGitRepo);
  await run('git init');
  const actual_isGitRepo = await isGitRepo();
  t.ok(actual_isGitRepo);
  const actual_notTagExists = await tagExists('1.0.0');
  t.notOk(actual_notTagExists);
  await run('touch file1');
  const actual_notIsWorkingDirClean = await isWorkingDirClean();
  t.notOk(actual_notIsWorkingDirClean);
  await run('git add file1');
  await run('git commit -am "Add file1"');
  await run('git tag 1.0.0');
  const actual_tagExists = await tagExists('1.0.0');
  t.ok(actual_tagExists);
  const actual_isWorkingDirClean = await isWorkingDirClean();
  t.ok(actual_isWorkingDirClean);
  await popd();
  await run(`rm -rf ${tmp}`);
  t.end();
});

test('getRemoteUrl', async t => {
  const remoteUrl = await getRemoteUrl();
  t.equal(remoteUrl, 'git@github.com:webpro/release-it.git');
  t.end();
});

test('clone + stage + commit + tag + push', async t => {
  const dir = 'test/resources';
  const tmp = `${dir}/tmp`;
  await mkCleanDir(tmp);
  await clone('https://github.com/webpro/release-it-test.git', tmp);
  await pushd(tmp);
  const pkgBefore = await readJSON('package.json');
  const versionBefore = pkgBefore.version;
  const actual_latestTagBefore = await getLatestTag();
  t.ok(await isGitRepo());
  t.equal(versionBefore, actual_latestTagBefore);
  await run('!echo line >> file1');
  await stage('file1');
  await commit('.', 'Update file1');
  await run('npm --no-git-tag-version version patch');
  await stage('package.json');
  const nextVersion = semver.inc(versionBefore, 'patch');
  await commit('.', 'Release v%s', nextVersion);
  await tag(nextVersion, 'v%s', 'Release v%');
  const pkgAfter = await readJSON('package.json');
  const actual_latestTagAfter = await getLatestTag();
  t.equal(pkgAfter.version, actual_latestTagAfter);
  await push();
  const status = await run('!git status -uno');
  t.ok(status.includes('nothing to commit'));
  await popd();
  await run(`rm -rf ${tmp}`);
  t.end();
});