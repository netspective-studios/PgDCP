# Welcome to the Ansible Playbook for Installing PgDCP

## Server software requirements
Ubuntu 18.04/20.04 or similar Linux distribution on a cloud instance such as AWS EC2 is required. If you are an expert in working on other cloud instances, you can execute similar steps there.

The following is the minimum requirements required for the EC2 instance
 - RAM: minimum 4096 megabytes, preferably 8192 megabytes
 - vCPU: minimum 2
 - Storage: minimum 32 gigabytes, preferably 256 gigabytes
 - Network: Accessible outbound to the Internet (both IPv4 and IPv6), inbound access not required
 - Firewall: Use a security group with appropriate inbound rules
 
NOTE: Since we are handling PHI data in this instance, it should be deployed only in a private subnet. This will mean that public IP is not directly attached to this instance. We should use any NAT gateway to access internet in this instance.
 
 ### After completing the EC2 initialization, we get the following defaults
 - Private IP address of this instance
 - Instance User Name: ubuntu
 - [AWS System Manager Agent (SSM)](https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent.html) is preinstalled
 
## Connect to this Linux instance using Session Manager
To connect using Session Manager, follow the instructions [here](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/session-manager.html).

# One-time Setup
## Install Ansible on this instance
Execute the following commands from the Session Manager terminal.
```
sudo apt update
sudo apt install python2.7 ansible git -y 
sudo update-alternatives --install /usr/bin/python python /usr/bin/python2.7 1
sudo apt install python-pip    // This package only required for Ubuntu 18.04 
```
## Clone the git Repository 
```
git clone https://github.com/netspective-studios/PgDCP.git
cd PgDCP/support
```

## Set variables
```
vim.tiny main.yml
```
After cloning and checkout, set only the following variables in `main.yml` with your system/application details.
```
Host_IP : <Private IPv4 address of instance>
DB_Name : <Database name>
DB_User : <Database username>
DB_Password : <Database password>
Promscale_ReadOnly_Password : <Promscale password>
```
## Execute the below command for PgDCP installation
```bash 
sudo ansible-playbook main.yml
```
# The following PostgreSQL extensions will be installed along with the PgDCP installation


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

