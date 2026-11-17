package com.enonic.app.formbuilder;

import com.enonic.xp.testing.ScriptRunnerSupport;

public class MigrationScriptTest
    extends ScriptRunnerSupport
{
    @Override
    public String getScriptTestFile()
    {
        return "/test/migration-test.js";
    }
}
