class EmailTemplate:
    def __init__(self):
        self.default_template = """
Dear {{recruiter_name}},

I hope this email finds you well. I am writing to express my strong interest in software engineering opportunities at {{company_name}}.

[Your customizable email content here]

Thank you for considering my application.

Best regards,
[Your Name]
"""
        self.current_template = self.default_template

    def set_template(self, template: str):
        """Update the current template"""
        self.current_template = template

    def generate_email(self, recruiter_name: str, company_name: str) -> str:
        return self.current_template.replace('{{recruiter_name}}', recruiter_name).replace('{{company_name}}', company_name)