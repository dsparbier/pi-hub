# Clean Project

This command runs in whatever project repo is is executed in. Scan the project folder structure, may not have any specific project conventions. Detect rather than assume; skip a step gracefully (and say so in the report) rather than failing if its precondition doesn't hold.

Execute the clean-up in sequence:

1. **Review the current development project folder** Review the current project folders and children folder

2. **Move file to the correct locations** Move files to correct locations, as these drift during development, ensure that files such as documents are placed in the ./docs folder, etc.

3. **Purge files no longer required** Purge old files no longer needed, remove any TMP files, etc.

4. **Update .gitignore with appropriate entries** Ensure that Git Ignore is updated, to exclude any non-project files.

Report each step as it completes, explicitly noting any step that was skipped and why.