# SoulSeer AWS Deployment Guide

This guide walks through deploying the SoulSeer application on AWS services for enhanced scalability and enterprise-level infrastructure.

## AWS Deployment Prerequisites

1. An AWS account
2. AWS CLI installed and configured
3. AWS Amplify CLI installed (optional for simplified deployment)
4. Knowledge of basic AWS services

## Deployment Options

### Option 1: AWS Amplify (Simplest)

AWS Amplify offers a streamlined deployment process for full-stack applications.

#### Setup Steps

1. **Install and Configure Amplify CLI**:
   ```bash
   npm install -g @aws-amplify/cli
   amplify configure
   ```

2. **Initialize Amplify in Your Project**:
   ```bash
   amplify init
   ```
   Follow the prompts to set up your project.

3. **Add a Hosting Service**:
   ```bash
   amplify add hosting
   ```
   Choose between Amplify Console (CI/CD, recommended) or S3 and CloudFront.

4. **Add a Database**:
   ```bash
   amplify add storage
   ```
   Select Amazon DynamoDB or Aurora Serverless for PostgreSQL compatibility.

5. **Add Authentication**:
   ```bash
   amplify add auth
   ```

6. **Deploy Your Application**:
   ```bash
   amplify publish
   ```

7. **Configure Environment Variables** in the Amplify Console.

### Option 2: Containerized Deployment with ECS

For more control over your infrastructure:

1. **Create a Dockerfile** at the root of your project:
   ```dockerfile
   FROM node:20-alpine
   
   WORKDIR /app
   
   COPY package*.json ./
   RUN npm install
   
   COPY . .
   RUN npm run build
   
   EXPOSE 3000
   
   CMD ["npm", "start"]
   ```

2. **Build and Push to Amazon ECR**:
   ```bash
   aws ecr create-repository --repository-name soulseer-app
   aws ecr get-login-password | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
   docker build -t soulseer-app .
   docker tag soulseer-app:latest <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/soulseer-app:latest
   docker push <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/soulseer-app:latest
   ```

3. **Create an ECS Cluster and Service** using AWS Management Console or CLI.

4. **Configure RDS** for PostgreSQL database.

5. **Set up Application Load Balancer** for traffic distribution.

6. **Configure environment variables** in the ECS task definition.

## Database Configuration

### Using RDS for PostgreSQL

1. **Create a PostgreSQL Database** in RDS:
   - Choose PostgreSQL as the engine
   - Select an appropriate instance size
   - Configure storage
   - Set master username and password
   - Enable encryption if needed

2. **Configure Security Groups** to allow application access.

3. **Update Environment Variables** to use the RDS endpoint:
   ```
   DATABASE_URL=postgres://<username>:<password>@<rds-endpoint>:5432/<database-name>
   ```

4. **Run Migrations**:
   ```bash
   DATABASE_URL=postgres://<username>:<password>@<rds-endpoint>:5432/<database-name> npm run db:push
   ```

## Setting Up CloudFront for Content Delivery

1. **Create a CloudFront Distribution**:
   - Use your application's domain as the origin
   - Configure cache behaviors
   - Set up SSL certificate

2. **Update DNS Records** to point to CloudFront distribution.

## Monitoring and Logging

1. **Set Up CloudWatch Alarms** for CPU, memory, and database metrics.

2. **Configure CloudWatch Logs** for application logging:
   ```javascript
   // Modify server logging to use compatible format
   console.log(JSON.stringify({
     level: 'info',
     message: 'Server started',
     timestamp: new Date().toISOString()
   }));
   ```

3. **Set Up X-Ray** for request tracing (optional).

## CI/CD Pipeline

1. **Create a CodeBuild Project** for building your application.

2. **Set Up CodePipeline** to automate deployments:
   - Source: Connect to your GitHub or CodeCommit repository
   - Build: Use the CodeBuild project
   - Deploy: Deploy to ECS, Elastic Beanstalk, or Amplify

3. **Configure Webhooks** to trigger deployments on code changes.

## Scaling Configuration

1. **Set Up Auto Scaling** for ECS services:
   ```bash
   aws application-autoscaling register-scalable-target \
     --service-namespace ecs \
     --scalable-dimension ecs:service:DesiredCount \
     --resource-id service/<cluster-name>/<service-name> \
     --min-capacity 2 \
     --max-capacity 10
   ```

2. **Create Scaling Policies** based on CPU or custom metrics:
   ```bash
   aws application-autoscaling put-scaling-policy \
     --service-namespace ecs \
     --scalable-dimension ecs:service:DesiredCount \
     --resource-id service/<cluster-name>/<service-name> \
     --policy-name cpu-tracking-scaling-policy \
     --policy-type TargetTrackingScaling \
     --target-tracking-scaling-policy-configuration file://policy-config.json
   ```

## Preparation for Mobile App Publishing

### Using AWS Amplify for Mobile Integration

1. **Initialize Amplify in your Mobile Project**:
   ```bash
   amplify init
   ```

2. **Add API and Auth Features**:
   ```bash
   amplify add api
   amplify add auth
   ```

3. **Generate Mobile Configuration**:
   ```bash
   amplify codegen
   ```

4. **Build your Mobile App** with the Amplify configuration.

## Security Considerations

1. **Enable AWS WAF** for application protection.

2. **Set Up Security Groups** with minimal required access.

3. **Enable Amazon GuardDuty** for threat detection.

4. **Use AWS Secrets Manager** for sensitive credentials.

## Backup and Disaster Recovery

1. **Configure RDS Automated Backups**.

2. **Set Up Multi-Region Replication** for critical data.

3. **Create Disaster Recovery Procedures**.

## Cost Management

1. **Set Up AWS Budgets** to monitor spending.

2. **Use Reserved Instances** for predictable workloads.

3. **Configure Auto Scaling** to scale down during low-traffic periods.

## Troubleshooting Common Issues

- **Deployment Failures**: Check CodeBuild and deployment logs
- **Database Connection Issues**: Verify security group and network ACL settings
- **Performance Problems**: Monitor CloudWatch metrics and configure alarms
- **SSL/TLS Issues**: Ensure certificates are properly configured in ACM

## Additional Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Amazon ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Amazon RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS CloudFormation Templates](https://aws.amazon.com/cloudformation/resources/templates/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)