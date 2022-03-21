# Ansible Playbooks for Installing PostgreSQL 13 and it's required extensions in VM

This playbook will help you to deploy PgDCP (PostgreSQL Data Computing Platform) in Ubuntu 18.04/20.04 servers.

## Server Requirements
- Single core Processor (Minimum)
- 4GB RAM
- 40GB SSD
## To check the server details, goto Settings
`
Settings -> About
`
## To check PgDCP is already installed
```
psql --version
```

 If PgDCP is installed output will be like 
 
 `psql (PostgreSQL) 13.6 (Ubuntu 13.6-1.pgdg20.04+1)`
 
 If PgDCP is not installed output will be like

`
Command 'psql' not found, but can be installed with:
sudo apt install postgresql-client-common
`

For installing PgDCP follow the below steps.

# One-time Setup
## Install Ansible on VM
Execute the following commands in your Ubuntu terminal.
```
sudo apt update
sudo apt install python2
sudo update-alternatives --install /usr/bin/python python /usr/bin/python2 1
sudo apt install ansible -y
```
## Move to the HOME folder and Install git

```
cd $HOME
sudo apt install git
```
## Clone the git Repository 
```

git clone https://github.com/netspective/PgDCP.git

cd PgDCP

```
**NOTE:** Sometimes you may face a Certificate issue. In this case you need to export the certificate using the following command
```
export GIT_SSL_NO_VERIFY=1
```
## Git checkout
Use `Main` branch for deployment.
```
git checkout main
```

After cloning and checkout, set the variables **Host_IP, Postgres_Config_Path, DB_Name_to_Enable_PG_CRON, DB_User, DB_Name, DB_Password** in  `main.yml` with your system/application details.


## Execute the below command for PgDCP installation
```bash 
sudo ansible-playbook main.yml
```
# Install system utilities

Please add only `system_utilities` role in `main.yml` file to install `just, deno, sqlite and pgloader` utilities.

Listed below are few sample extensions that will be installed,

    plpython
    plsh
    plperl
    pljava
    postgis
    pgtap
    plpgsql_check
    pgsql-http
    pgsparql
    pgaudit
    pg_cron
    pg-semver
    pillow
    is_jsonb_valid
    file_text_array_fdw
    safeupdate
    pgvector
    timescaledb
    git_fdw
    sqlite_fdw
    supascript

