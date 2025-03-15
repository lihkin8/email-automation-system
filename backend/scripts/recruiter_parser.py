# scripts/recruiter_parser.py
from dataclasses import dataclass
from typing import List

@dataclass
class Recruiter:
    name: str
    email: str
    company: str

class RecruiterParser:
    def __init__(self, file_path: str):
        self.file_path = file_path

    def parse_recruiters(self):
        recruiters = []
        current_company = None

        with open(self.file_path, 'r') as file:
            for line in file:
                line = line.strip()
                if not line:
                    continue
                # If the line is a company header (e.g., ends with ':' or does not contain an email)
                if ':' in line or ('@' not in line):
                    current_company = line.replace(':', '').strip()
                    continue

                try:
                    # Split on the last occurrence of '-' since email might contain hyphens
                    email_part, name = line.rsplit('-', 1)
                    email = email_part.strip()
                    name = name.strip()

                    recruiters.append(
                        type('Recruiter', (), {
                            'email': email,
                            'name': name,
                            'company': current_company
                        })
                    )
                except Exception as e:
                    logger.error(f"Error parsing line: {line}. Error: {str(e)}")
                    continue

        return recruiters
